/**
 * Day 4-5: Wrapper component that integrates call quality monitoring with VideoChat
 */

import React, { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../store';
import { CallQualityMonitor, FailureDetector, CallQualityStatus } from '../../services/callQualityMonitor';
import {
  setCallQualityStatus,
  setCallQualityMetrics,
  setCallInstability,
  showZoomFallbackDialog,
} from '../../actions/callQualityActions';
import { currentPeerConnection } from '../../socket/socketConnection';
import { getFirstRoomPeerConnection } from '../../socket/webRTC';
import Peer from 'simple-peer';
import { clearVideoChat } from '../../actions/videoChatActions';
import { createZoomMeetingForEvent, createZoomMeetingForGroupChat } from '../../api/api';
import { setZoomMeetingDetails } from '../../actions/callQualityActions';
import { showAlert } from '../../actions/alertActions';

interface CallQualityMonitorWrapperProps {
  isCallActive: boolean;
  eventId?: string;
  groupChatId?: string;
  otherUserId?: string;
  onLeaveMeeting: () => void;
}

const CallQualityMonitorWrapper: React.FC<CallQualityMonitorWrapperProps> = ({
  isCallActive,
  eventId,
  groupChatId,
  otherUserId,
  onLeaveMeeting,
}) => {
  console.log('[CallQualityMonitorWrapper] Component rendered', {
    isCallActive,
    eventId,
    groupChatId,
  });

  const dispatch = useDispatch();
  const monitorRef = useRef<CallQualityMonitor | null>(null);
  const detectorRef = useRef<FailureDetector | null>(null);
  const { callQuality, videoChat, room } = useAppSelector((state) => state);

  // Log immediately to verify component state
  console.log('[CallQualityMonitorWrapper] Component state check:', {
    isCallActive,
    hasCallQuality: !!callQuality,
    hasVideoChat: !!videoChat,
    hasRoom: !!room,
    hasLocalStream: !!videoChat?.localStream,
    hasRoomStream: !!room?.localStreamRoom,
  });

  useEffect(() => {
    console.log('[CallQualityMonitorWrapper] ====== useEffect EXECUTING ======', {
      isCallActive,
      hasLocalStream: !!videoChat.localStream,
      hasRoomStream: !!room.localStreamRoom,
      callStatus: videoChat.callStatus,
      isUserInRoom: room.isUserInRoom,
      eventId,
      groupChatId,
    });

    if (!isCallActive) {
      console.log('[CallQualityMonitorWrapper] Call not active, cleaning up');
      // Cleanup when call ends
      if (monitorRef.current) {
        monitorRef.current.stopMonitoring();
        monitorRef.current.destroy();
        monitorRef.current = null;
      }
      if (detectorRef.current) {
        detectorRef.current.destroy();
        detectorRef.current = null;
      }
      dispatch(setCallQualityStatus(CallQualityStatus.STABLE));
      dispatch(setCallInstability(false));
      return;
    }

    console.log('[CallQualityMonitorWrapper] Call is active, initializing monitoring...');

    let retryTimeout: NodeJS.Timeout | null = null;
    let retryInterval: NodeJS.Timeout | null = null;

    function initializeMonitoring() {
      console.log('[CallQualityMonitorWrapper] initializeMonitoring called');
      // Get peer connection - try direct call first, then room call
      let peerConnection = currentPeerConnection;
      console.log('[CallQualityMonitorWrapper] Direct peer connection:', !!peerConnection);
      
      // If no direct call peer connection, try to get room peer connection
      if (!peerConnection) {
        console.log('[CallQualityMonitorWrapper] No direct peer, checking room peers...');
        peerConnection = getFirstRoomPeerConnection();
        if (peerConnection) {
          console.log('[CallQualityMonitorWrapper] Using room peer connection');
        } else {
          console.log('[CallQualityMonitorWrapper] No room peer connection found');
        }
      }
      
      if (!peerConnection) {
        console.warn('[CallQualityMonitorWrapper] Peer connection not available yet (direct or room)');
        console.log('[CallQualityMonitorWrapper] Checking state:', {
          hasDirectPeer: !!currentPeerConnection,
          hasRoomPeer: !!getFirstRoomPeerConnection(),
          isCallActive,
          hasLocalStream: !!videoChat.localStream,
          hasRoomStream: !!room.localStreamRoom,
          roomActiveRooms: room.activeRooms?.length || 0,
        });
        
        // More aggressive retry - keep trying every 1 second for up to 30 seconds
        let retryCount = 0;
        const maxRetries = 30;
        
        retryInterval = setInterval(() => {
          retryCount++;
          const directPeer = currentPeerConnection;
          const roomPeer = getFirstRoomPeerConnection();
          
          if (directPeer || roomPeer) {
            console.log('[CallQualityMonitorWrapper] Peer connection now available, retrying...');
            if (retryInterval) {
              clearInterval(retryInterval);
              retryInterval = null;
            }
            if (retryTimeout) {
              clearTimeout(retryTimeout);
              retryTimeout = null;
            }
            initializeMonitoring();
          } else if (retryCount >= maxRetries) {
            console.warn('[CallQualityMonitorWrapper] Max retries reached, stopping retry attempts');
            if (retryInterval) {
              clearInterval(retryInterval);
              retryInterval = null;
            }
          } else {
            console.log(`[CallQualityMonitorWrapper] Retry ${retryCount}/${maxRetries} - still no peer connection`);
          }
        }, 1000);
        
        // Also set the timeout for cleanup
        retryTimeout = setTimeout(() => {
          if (retryInterval) {
            clearInterval(retryInterval);
            retryInterval = null;
          }
        }, maxRetries * 1000);
        
        return;
      }

      // Initialize failure detector
      // Thresholds optimized for 3G network detection (balanced for reliability)
      const detector = new FailureDetector(
        {
          audioPacketLoss: 1,        // 1% packet loss (3G-level)
          videoPacketLoss: 1.5,      // 1.5% packet loss (3G-level)
          rtt: 200,                  // 200ms RTT (3G-level latency)
          audioJitter: 25,           // 25ms jitter (3G-level)
          videoJitter: 40,           // 40ms jitter (3G-level)
          violationDuration: 1500,   // 1.5 seconds sustained violation
          debounceWindow: 2500,      // 2.5 seconds debounce
          recoveryWindow: 5000,      // 5 seconds recovery
        },
        (status) => {
          console.log('[CallQualityMonitorWrapper] Status changed:', status);
          dispatch(setCallQualityStatus(status));
          
          // Show dialog when unstable or failed
          if (status === CallQualityStatus.UNSTABLE || status === CallQualityStatus.FAILED) {
            console.log('[CallQualityMonitorWrapper] Instability detected - showing Zoom button');
            dispatch(setCallInstability(true));
            dispatch(showZoomFallbackDialog());
          } else if (status === CallQualityStatus.STABLE && callQuality.instabilityDetected) {
            // Connection recovered
            console.log('[CallQualityMonitorWrapper] Connection recovered - hiding Zoom button');
            dispatch(setCallInstability(false));
          }
        }
      );
      detectorRef.current = detector;

      // Initialize monitor
      const monitor = new CallQualityMonitor(
        peerConnection as Peer.Instance,
        (metrics) => {
          console.log('[CallQualityMonitorWrapper] Metrics received:', {
            audioPacketLoss: metrics.audio.packetLoss,
            videoPacketLoss: metrics.video.packetLoss,
            rtt: metrics.connection.rtt,
            iceState: metrics.connection.iceConnectionState,
            connectionState: metrics.connection.connectionState,
          });
          dispatch(setCallQualityMetrics(metrics));
          detector.processMetrics(metrics);
        }
      );
      monitorRef.current = monitor;

      // Start monitoring
      console.log('[CallQualityMonitorWrapper] Starting call quality monitoring');
      monitor.startMonitoring();
    }

    // Start initialization
    initializeMonitoring();

    // Cleanup function
    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
      }
      if (retryInterval) {
        clearInterval(retryInterval);
        retryInterval = null;
      }
      if (monitorRef.current) {
        monitorRef.current.stopMonitoring();
        monitorRef.current.destroy();
        monitorRef.current = null;
      }
      if (detectorRef.current) {
        detectorRef.current.destroy();
        detectorRef.current = null;
      }
    };
  }, [isCallActive, dispatch, eventId, groupChatId, otherUserId, videoChat.localStream, room.localStreamRoom, callQuality?.instabilityDetected]);

  // Handler for joining Zoom meeting
  const handleJoinZoom = async () => {
    try {
      dispatch(setZoomMeetingDetails(null));
      let response;

      // Check if we have an event or group chat (prioritize eventId if both are provided)
      if (eventId) {
        response = await createZoomMeetingForEvent({ eventId });
      } else if (groupChatId) {
        response = await createZoomMeetingForGroupChat({ groupChatId });
      } else {
        dispatch(showAlert('No event or group chat ID available for Zoom meeting'));
        return;
      }
      
      if (response.status === 'SUCCESS' && response.meeting) {
        // Log if meeting was reused
        if (response.reused) {
          console.log('[CallQualityMonitorWrapper] Reusing existing Zoom meeting:', response.meeting.meetingId);
        } else {
          console.log('[CallQualityMonitorWrapper] Created new Zoom meeting:', response.meeting.meetingId);
        }

        dispatch(setZoomMeetingDetails({
          meetingId: response.meeting.meetingId,
          joinUrl: response.meeting.joinUrl,
          password: response.meeting.password,
          meetingNumber: response.meeting.meetingNumber,
        }));
        
        // TODO: Day 8 - Join Zoom meeting inside app
        // For now, open in new window - force web browser joining
        if (response.meeting.joinUrl) {
          // Convert to web client URL to join in browser instead of desktop app
          // Replace /j/ with /wc/join/ to force web client
          let webJoinUrl = response.meeting.joinUrl;
          if (webJoinUrl.includes('/j/')) {
            webJoinUrl = webJoinUrl.replace('/j/', '/wc/join/');
          }
          // Add web parameter if not already present
          if (!webJoinUrl.includes('?web=') && !webJoinUrl.includes('&web=')) {
            webJoinUrl += webJoinUrl.includes('?') ? '&web=true' : '?web=true';
          }
          window.open(webJoinUrl, '_blank');
        }
        
        // Leave current WebRTC call
        onLeaveMeeting();
      } else {
        dispatch(showAlert(response.error || 'Failed to create Zoom meeting'));
      }
    } catch (error: any) {
      console.error('[CallQualityMonitorWrapper] Error creating Zoom meeting:', error);
      dispatch(showAlert('Failed to create Zoom meeting. Please try again.'));
    }
  };

  // Handler for leaving meeting
  const handleLeaveMeeting = () => {
    dispatch(showZoomFallbackDialog());
    onLeaveMeeting();
  };

  return null; // This is a wrapper component, no UI
};

export default CallQualityMonitorWrapper;

