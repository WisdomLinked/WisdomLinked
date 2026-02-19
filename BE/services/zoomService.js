const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class ZoomService {
    constructor() {
        this.clientId = process.env.ZOOM_CLIENT_ID;
        this.clientSecret = process.env.ZOOM_CLIENT_SECRET;
        this.accountId = process.env.ZOOM_ACCOUNT_ID;
        this.baseURL = 'https://api.zoom.us/v2';
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    // Server-to-Server OAuth Token Generation
    async getAccessToken() {
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        // Validate credentials are set
        if (!this.clientId || !this.clientSecret || !this.accountId) {
            const missing = [];
            if (!this.clientId) missing.push('ZOOM_CLIENT_ID');
            if (!this.clientSecret) missing.push('ZOOM_CLIENT_SECRET');
            if (!this.accountId) missing.push('ZOOM_ACCOUNT_ID');
            throw new Error(`Missing Zoom credentials in environment variables: ${missing.join(', ')}. Please see ZOOM_SETUP.md for instructions.`);
        }

        try {
            const token = jwt.sign(
                {
                    iss: this.clientId,
                    exp: Math.floor(Date.now() / 1000) + 3600,
                },
                this.clientSecret,
                { algorithm: 'HS256' }
            );

            const response = await axios.post(
                `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${this.accountId}`,
                {},
                {
                    headers: {
                        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
                    },
                }
            );

            this.accessToken = response.data.access_token;
            this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // 1 min buffer

            return this.accessToken;
        } catch (error) {
            console.error('[ZoomService] Error getting access token:', error.response?.data || error.message);
            const errorMessage = error.response?.data?.error_description || error.message || 'Failed to obtain Zoom access token';
            throw new Error(`Failed to obtain Zoom access token: ${errorMessage}`);
        }
    }

    // Create a Zoom Meeting
    async createMeeting(meetingData) {
        try {
            const token = await this.getAccessToken();
            const { topic, startTime, duration, password, settings } = meetingData;

            const response = await axios.post(
                `${this.baseURL}/users/me/meetings`,
                {
                    topic: topic || 'Meeting',
                    type: 2, // Scheduled meeting
                    start_time: startTime ? new Date(startTime).toISOString() : undefined,
                    duration: duration || 60,
                    password: password || this.generatePassword(),
                    settings: {
                        host_video: true,
                        participant_video: true,
                        join_before_host: false,
                        mute_upon_entry: false,
                        waiting_room: false,
                        ...settings,
                    },
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            return {
                meetingId: response.data.id,
                joinUrl: response.data.join_url,
                startUrl: response.data.start_url,
                password: response.data.password,
                meetingNumber: response.data.id.toString(),
                ...response.data,
            };
        } catch (error) {
            console.error('[ZoomService] Error creating meeting:', error.response?.data || error.message);
            throw new Error('Failed to create Zoom meeting');
        }
    }

    // Update Meeting
    async updateMeeting(meetingId, updates) {
        try {
            const token = await this.getAccessToken();
            await axios.patch(
                `${this.baseURL}/meetings/${meetingId}`,
                updates,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
            return true;
        } catch (error) {
            console.error('[ZoomService] Error updating meeting:', error.response?.data || error.message);
            throw new Error('Failed to update Zoom meeting');
        }
    }

    // Delete Meeting
    async deleteMeeting(meetingId) {
        try {
            const token = await this.getAccessToken();
            await axios.delete(
                `${this.baseURL}/meetings/${meetingId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                }
            );
            return true;
        } catch (error) {
            console.error('[ZoomService] Error deleting meeting:', error.response?.data || error.message);
            throw new Error('Failed to delete Zoom meeting');
        }
    }

    // Get Meeting Details
    async getMeeting(meetingId) {
        try {
            const token = await this.getAccessToken();
            const response = await axios.get(
                `${this.baseURL}/meetings/${meetingId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                }
            );
            return response.data;
        } catch (error) {
            console.error('[ZoomService] Error getting meeting:', error.response?.data || error.message);
            throw new Error('Failed to get Zoom meeting');
        }
    }

    // Generate Meeting Password
    generatePassword() {
        return crypto.randomBytes(4).toString('hex');
    }

    // Generate SDK Signature (for client-side authentication)
    generateSDKSignature(meetingNumber, role) {
        const timestamp = new Date().getTime() - 30000;
        const msg = Buffer.from(`${process.env.ZOOM_CLIENT_ID}${meetingNumber}${timestamp}${role}`).toString('base64');
        const hash = crypto.createHmac('sha256', process.env.ZOOM_CLIENT_SECRET).update(msg).digest('base64');
        const signature = Buffer.from(`${process.env.ZOOM_CLIENT_ID}.${meetingNumber}.${timestamp}.${role}.${hash}`).toString('base64');
        return signature;
    }

    // Check if meeting is expired (default: 24 hours)
    isMeetingExpired(expiresAt, expirationHours = 24) {
        if (!expiresAt) return true;
        const expirationTime = new Date(expiresAt).getTime();
        const expirationDuration = expirationHours * 60 * 60 * 1000; // Convert hours to milliseconds
        return Date.now() > (expirationTime + expirationDuration);
    }
}

module.exports = new ZoomService();

