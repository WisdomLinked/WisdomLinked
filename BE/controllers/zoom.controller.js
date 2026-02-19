const zoomService = require('../services/zoomService');
const GroupChat = require('../models/GroupChat');
const Event = require('../models/Event');
const User = require('../models/User');

// Helper function to check if existing meeting is valid
const getValidExistingMeeting = (zoomMeeting, expirationHours = 24) => {
    if (!zoomMeeting || !zoomMeeting.meetingId) {
        return null;
    }

    // Check if meeting has expired
    if (zoomService.isMeetingExpired(zoomMeeting.expiresAt, expirationHours)) {
        return null; // Meeting expired, need to create new one
    }

    // Return existing meeting if still valid
    return {
        meetingId: zoomMeeting.meetingId,
        joinUrl: zoomMeeting.joinUrl,
        startUrl: zoomMeeting.startUrl,
        password: zoomMeeting.password,
        meetingNumber: zoomMeeting.meetingNumber,
        hostUserId: zoomMeeting.hostUserId,
        createdAt: zoomMeeting.createdAt,
        expiresAt: zoomMeeting.expiresAt,
    };
};

// Create Zoom Meeting for Event (with duplicate prevention)
const createZoomMeetingForEvent = async (req, res) => {
    try {
        const { userId } = req.user;
        const { eventId, startTime, duration } = req.body;

        if (!eventId) {
            return res.status(400).json({
                status: 'FAIL',
                error: 'Event ID is required'
            });
        }

        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({
                status: 'FAIL',
                error: 'Event not found'
            });
        }

        // Check if user is participant (expert or customer)
        const isExpert = event.expert && event.expert.toString() === userId;
        const isCustomer = event.customer && event.customer.toString() === userId;

        if (!isExpert && !isCustomer) {
            return res.status(403).json({
                status: 'FAIL',
                error: 'You are not authorized to create a meeting for this event'
            });
        }

        // Check if a valid meeting already exists
        const existingMeeting = getValidExistingMeeting(event.zoomMeeting);
        if (existingMeeting) {
            console.log('[createZoomMeetingForEvent] Reusing existing meeting:', existingMeeting.meetingId);
            
            // Determine if current user is the host (first to click) or participant
            const isHost = !event.zoomMeeting.hostUserId;
            let joinUrl = existingMeeting.joinUrl;
            
            if (isHost) {
                // First person to click becomes host - use startUrl
                if (event.zoomMeeting.startUrl) {
                    joinUrl = event.zoomMeeting.startUrl;
                    // Mark this user as the host
                    event.zoomMeeting.hostUserId = userId;
                    await event.save();
                    console.log('[createZoomMeetingForEvent] User', userId, 'is now the host');
                }
            } else {
                // Subsequent users join as participants - use joinUrl
                console.log('[createZoomMeetingForEvent] User', userId, 'joining as participant. Host is:', event.zoomMeeting.hostUserId);
            }
            
            return res.status(200).json({
                status: 'SUCCESS',
                meeting: {
                    ...existingMeeting,
                    joinUrl: joinUrl,
                    isHost: isHost,
                },
                event: event,
                reused: true,
            });
        }

        // If meeting exists but expired, we'll create a new one
        // (Optionally, we could delete the old meeting from Zoom, but for now we'll just create a new one)

        const expertUser = await User.findById(event.expert);
        const meetingData = {
            topic: event.title || `Meeting with ${expertUser?.username || 'Expert'}`,
            startTime: startTime || event.start,
            duration: duration || event.duration || 60,
            settings: {
                host_video: true,
                participant_video: true,
                join_before_host: false,
                mute_upon_entry: false,
                waiting_room: false,
            },
        };

        const zoomMeeting = await zoomService.createMeeting(meetingData);

        // Calculate expiration (24 hours from now)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        // Store Zoom meeting info in event
        event.zoomMeeting = {
            meetingId: zoomMeeting.meetingId,
            joinUrl: zoomMeeting.joinUrl,
            startUrl: zoomMeeting.startUrl, // Store host URL
            password: zoomMeeting.password,
            meetingNumber: zoomMeeting.meetingNumber,
            hostUserId: null, // Will be set when first person clicks
            createdAt: new Date(),
            expiresAt: expiresAt,
        };
        await event.save();

        console.log('[createZoomMeetingForEvent] Created new meeting:', zoomMeeting.meetingId);

        // First person to create the meeting becomes the host
        event.zoomMeeting.hostUserId = userId;
        await event.save();
        console.log('[createZoomMeetingForEvent] User', userId, 'is the host (created new meeting)');

        return res.status(200).json({
            status: 'SUCCESS',
            meeting: {
                meetingId: zoomMeeting.meetingId,
                joinUrl: zoomMeeting.startUrl, // First person gets host URL
                password: zoomMeeting.password,
                meetingNumber: zoomMeeting.meetingNumber,
                isHost: true,
            },
            event: event,
            reused: false,
        });
    } catch (error) {
        console.error('[createZoomMeetingForEvent]', error.message);
        // Provide helpful error message if credentials are missing
        if (error.message.includes('Missing Zoom credentials')) {
            return res.status(500).json({
                status: 'FAIL',
                error: 'Zoom integration is not configured. Please add Zoom credentials to your .env file. See ZOOM_SETUP.md for instructions.'
            });
        }
        return res.status(500).json({
            status: 'FAIL',
            error: error.message || 'Failed to create Zoom meeting'
        });
    }
};

// Create Zoom Meeting for Group Chat (with duplicate prevention)
const createZoomMeetingForGroupChat = async (req, res) => {
    try {
        const { userId } = req.user;
        const { groupChatId, startTime, duration } = req.body;

        if (!groupChatId) {
            return res.status(400).json({
                status: 'FAIL',
                error: 'Group chat ID is required'
            });
        }

        const groupChat = await GroupChat.findById(groupChatId);
        if (!groupChat) {
            return res.status(404).json({
                status: 'FAIL',
                error: 'Group chat not found'
            });
        }

        // Check if user is participant or admin
        const isParticipant = groupChat.participants.some(p => p.toString() === userId);
        const isAdmin = groupChat.admin && groupChat.admin.toString() === userId;

        if (!isParticipant && !isAdmin) {
            return res.status(403).json({
                status: 'FAIL',
                error: 'You are not authorized to create a meeting for this chat'
            });
        }

        // Check if a valid meeting already exists
        const existingMeeting = getValidExistingMeeting(groupChat.zoomMeeting);
        if (existingMeeting) {
            console.log('[createZoomMeetingForGroupChat] Reusing existing meeting:', existingMeeting.meetingId);
            
            // Determine if current user is the host (first to click) or participant
            const isHost = !groupChat.zoomMeeting.hostUserId;
            let joinUrl = existingMeeting.joinUrl;
            
            if (isHost) {
                // First person to click becomes host - use startUrl
                if (groupChat.zoomMeeting.startUrl) {
                    joinUrl = groupChat.zoomMeeting.startUrl;
                    // Mark this user as the host
                    groupChat.zoomMeeting.hostUserId = userId;
                    await groupChat.save();
                    console.log('[createZoomMeetingForGroupChat] User', userId, 'is now the host');
                }
            } else {
                // Subsequent users join as participants - use joinUrl
                console.log('[createZoomMeetingForGroupChat] User', userId, 'joining as participant. Host is:', groupChat.zoomMeeting.hostUserId);
            }
            
            return res.status(200).json({
                status: 'SUCCESS',
                meeting: {
                    ...existingMeeting,
                    joinUrl: joinUrl,
                    isHost: isHost,
                },
                groupChat: groupChat,
                reused: true,
            });
        }

        // Create new meeting
        const meetingData = {
            topic: groupChat.name,
            startTime: startTime || groupChat.start || undefined,
            duration: duration || groupChat.duration || 60,
            settings: {
                host_video: true,
                participant_video: true,
                join_before_host: false,
                mute_upon_entry: false,
                waiting_room: false,
            },
        };

        const zoomMeeting = await zoomService.createMeeting(meetingData);

        // Calculate expiration (24 hours from now)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        // Store Zoom meeting info in group chat
        groupChat.zoomMeeting = {
            meetingId: zoomMeeting.meetingId,
            joinUrl: zoomMeeting.joinUrl,
            startUrl: zoomMeeting.startUrl, // Store host URL
            password: zoomMeeting.password,
            meetingNumber: zoomMeeting.meetingNumber,
            hostUserId: null, // Will be set when first person clicks
            createdAt: new Date(),
            expiresAt: expiresAt,
        };
        await groupChat.save();

        // First person to create the meeting becomes the host
        groupChat.zoomMeeting.hostUserId = userId;
        await groupChat.save();
        console.log('[createZoomMeetingForGroupChat] User', userId, 'is the host (created new meeting)');

        return res.status(200).json({
            status: 'SUCCESS',
            meeting: {
                meetingId: zoomMeeting.meetingId,
                joinUrl: zoomMeeting.startUrl, // First person gets host URL
                password: zoomMeeting.password,
                meetingNumber: zoomMeeting.meetingNumber,
                isHost: true,
            },
            groupChat: groupChat,
            reused: false,
        });
    } catch (error) {
        console.error('[createZoomMeetingForGroupChat]', error.message);
        // Provide helpful error message if credentials are missing
        if (error.message.includes('Missing Zoom credentials')) {
            return res.status(500).json({
                status: 'FAIL',
                error: 'Zoom integration is not configured. Please add Zoom credentials to your .env file. See ZOOM_SETUP.md for instructions.'
            });
        }
        return res.status(500).json({
            status: 'FAIL',
            error: error.message || 'Failed to create Zoom meeting'
        });
    }
};

// Get Zoom Meeting Details
const getZoomMeeting = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const meeting = await zoomService.getMeeting(meetingId);

        return res.status(200).json({
            status: 'SUCCESS',
            meeting: meeting,
        });
    } catch (error) {
        console.error('[getZoomMeeting]', error.message);
        return res.status(500).json({
            status: 'FAIL',
            error: error.message || 'Failed to get Zoom meeting'
        });
    }
};

// Get SDK Signature for Client
const getZoomSDKSignature = async (req, res) => {
    try {
        const { userId } = req.user;
        const { meetingNumber, role } = req.body;

        if (!meetingNumber) {
            return res.status(400).json({
                status: 'FAIL',
                error: 'Meeting number is required'
            });
        }

        // role: 0 = participant, 1 = host
        const signature = zoomService.generateSDKSignature(meetingNumber, role || 0);

        return res.status(200).json({
            status: 'SUCCESS',
            signature: signature,
            sdkKey: process.env.ZOOM_CLIENT_ID,
        });
    } catch (error) {
        console.error('[getZoomSDKSignature]', error.message);
        return res.status(500).json({
            status: 'FAIL',
            error: error.message || 'Failed to generate SDK signature'
        });
    }
};

// Delete Zoom Meeting
const deleteZoomMeeting = async (req, res) => {
    try {
        const { userId } = req.user;
        const { meetingId } = req.body;

        if (!meetingId) {
            return res.status(400).json({
                status: 'FAIL',
                error: 'Meeting ID is required'
            });
        }

        await zoomService.deleteMeeting(meetingId);

        // Remove from database records
        await GroupChat.updateMany(
            { 'zoomMeeting.meetingId': meetingId },
            { $unset: { zoomMeeting: 1 } }
        );
        await Event.updateMany(
            { 'zoomMeeting.meetingId': meetingId },
            { $unset: { zoomMeeting: 1 } }
        );

        return res.status(200).json({
            status: 'SUCCESS',
            message: 'Zoom meeting deleted successfully'
        });
    } catch (error) {
        console.error('[deleteZoomMeeting]', error.message);
        return res.status(500).json({
            status: 'FAIL',
            error: error.message || 'Failed to delete Zoom meeting'
        });
    }
};

module.exports = {
    createZoomMeetingForGroupChat,
    createZoomMeetingForEvent,
    getZoomMeeting,
    getZoomSDKSignature,
    deleteZoomMeeting,
};

