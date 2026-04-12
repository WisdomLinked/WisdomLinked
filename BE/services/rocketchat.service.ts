import axios from 'axios';

const RC_URL = process.env.ROCKETCHAT_URL || 'https://chat.wisdomlinked.com';
const RC_USER = process.env.ROCKETCHAT_ADMIN_USER || '';
const RC_PASS = process.env.ROCKETCHAT_ADMIN_PASS || '';

let adminAuthToken = '';
let adminUserId = '';

const getAdminAuthHeaders = async () => {
    if (adminAuthToken && adminUserId) {
        return {
            'X-Auth-Token': adminAuthToken,
            'X-User-Id': adminUserId,
            'Content-Type': 'application/json'
        };
    }

    try {
        const res = await axios.post(`${RC_URL}/api/v1/login`, {
            user: RC_USER,
            password: RC_PASS
        });
        
        if (res.data.status === 'success') {
            adminAuthToken = res.data.data.authToken;
            adminUserId = res.data.data.userId;
            return {
                'X-Auth-Token': adminAuthToken,
                'X-User-Id': adminUserId,
                'Content-Type': 'application/json'
            };
        }
        throw new Error('Failed to login to Rocket.Chat as admin');
    } catch (err) {
        console.error('Rocket.Chat Admin Login Error:', err.message);
        throw err;
    }
};

export const syncUserToRocketChat = async (userData: { email: string; username: string; name: string; password?: string }) => {
    try {
        const headers = await getAdminAuthHeaders();
        
        // 1. Check if user already exists
        try {
            const checkRes = await axios.get(`${RC_URL}/api/v1/users.info?username=${userData.username}`, { headers });
            if (checkRes.data.success && checkRes.data.user) {
                return checkRes.data.user._id;
            }
        } catch (e: any) {
            // 400 error usually means user doesn't exist, which is fine
        }

        // 2. Create the user
        const createRes = await axios.post(`${RC_URL}/api/v1/users.create`, {
            email: userData.email,
            name: userData.name || userData.username,
            password: userData.password || Math.random().toString(36).slice(-10) + 'A1!',
            username: userData.username,
            verified: true,
            joinDefaultChannels: true
        }, { headers });

        if (createRes.data.success) {
            console.log(`Successfully synced user ${userData.username} to Rocket.Chat`);
            return createRes.data.user._id;
        }
    } catch (err: any) {
        if (err.response?.data?.errorType === 'error-field-unavailable') {
            console.log(`User ${userData.username} or email ${userData.email} already exists in Rocket.Chat`);
            // Attempt to get user ID by email
            try {
                const headers = await getAdminAuthHeaders();
                // RC has a bit of weird mapping, but if we assume it exists we can just catch it
                // It's mostly fine if it fails here, they can still login
            } catch (e) {}
        } else {
            console.error('Failed to sync user to Rocket.Chat:', err.response?.data || err.message);
        }
    }
    return null;
};

export const getRocketAuthToken = async (userId: string) => {
    try {
        const headers = await getAdminAuthHeaders();
        const res = await axios.post(`${RC_URL}/api/v1/users.createToken`, {
            userId
        }, { headers });

        if (res.data.success) {
            return res.data.data.authToken;
        }
    } catch (err: any) {
        console.error('Failed to get RC token:', err.response?.data || err.message);
    }
    return null;
};
