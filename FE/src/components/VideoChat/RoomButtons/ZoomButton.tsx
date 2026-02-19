import React from "react";
import { useDispatch } from "react-redux";
import { useAppSelector } from "../../../store";
import { showZoomFallbackDialog } from "../../../actions/callQualityActions";
import { CallQualityStatus } from "../../../services/callQualityMonitor/types";
import Tooltip from "@mui/material/Tooltip";

const ZoomButton: React.FC = () => {
    const dispatch = useDispatch();
    const { callQuality } = useAppSelector((state) => state);

    // Check for connection issues from metrics
    const hasConnectionIssues = callQuality.metrics?.connection && (
        callQuality.metrics.connection.iceConnectionState === 'failed' ||
        callQuality.metrics.connection.iceConnectionState === 'disconnected' ||
        callQuality.metrics.connection.connectionState === 'failed' ||
        callQuality.metrics.connection.connectionState === 'disconnected'
    );

    // Check for high latency (3G throttling typically shows RTT > 150ms)
    const hasHighLatency = callQuality.metrics?.connection?.rtt && callQuality.metrics.connection.rtt > 150;

    // Check for 3G-level network issues
    // 3G typically has: RTT > 150ms, packet loss > 0.5%, or accumulating packet loss
    const has3GLevelIssues = React.useMemo(() => {
        if (callQuality.metrics) {
            const rtt = callQuality.metrics.connection?.rtt || 0;
            const audioLoss = callQuality.metrics.audio?.packetLoss || 0;
            const videoLoss = callQuality.metrics.video?.packetLoss || 0;
            const audioPacketsLost = callQuality.metrics.audio?.packetsLost || 0;
            const videoPacketsLost = callQuality.metrics.video?.packetsLost || 0;
            const totalPackets = (callQuality.metrics.audio?.packetsReceived || 0) + (callQuality.metrics.video?.packetsReceived || 0);
            const totalLost = audioPacketsLost + videoPacketsLost;
            
            // Show if any of these 3G indicators are present:
            // - RTT > 150ms (3G-level latency - more sensitive)
            // - Packet loss > 0.5% (3G-level loss - more sensitive)
            // - Accumulating packet loss (> 5 packets lost when we have enough data)
            const shouldShow = rtt > 150 || 
                              audioLoss > 0.5 || 
                              videoLoss > 0.5 || 
                              (totalPackets > 50 && totalLost > 5);
            
            if (shouldShow) {
                console.log('[ZoomButton] 3G-level issues detected:', { 
                    rtt, 
                    audioLoss, 
                    videoLoss, 
                    audioPacketsLost, 
                    videoPacketsLost,
                    totalPackets,
                    totalLost,
                    reason: rtt > 150 ? 'High RTT' : 
                           (audioLoss > 0.5 || videoLoss > 0.5) ? 'Packet loss %' : 
                           'Accumulating packet loss'
                });
            }
            return shouldShow;
        }
        return false;
    }, [callQuality.metrics]);

    // Only show button when there are network/connection issues (3G-level or worse)
    const shouldShowButton = 
        callQuality.instabilityDetected || 
        callQuality.status === CallQualityStatus.UNSTABLE ||
        callQuality.status === CallQualityStatus.FAILED ||
        hasConnectionIssues ||
        hasHighLatency ||
        has3GLevelIssues || // 3G-level network degradation
        (callQuality.status === CallQualityStatus.MONITORING && callQuality.instabilityDetected);

    // Debug logging
    React.useEffect(() => {
        if (callQuality.metrics) {
            console.log('[ZoomButton] State check:', {
                shouldShowButton,
                instabilityDetected: callQuality.instabilityDetected,
                status: callQuality.status,
                hasConnectionIssues,
                hasHighLatency,
                has3GLevelIssues,
                rtt: callQuality.metrics.connection?.rtt,
                audioPacketLoss: callQuality.metrics.audio?.packetLoss,
                videoPacketLoss: callQuality.metrics.video?.packetLoss,
                audioPacketsLost: callQuality.metrics.audio?.packetsLost,
                videoPacketsLost: callQuality.metrics.video?.packetsLost,
                totalPackets: (callQuality.metrics.audio?.packetsReceived || 0) + (callQuality.metrics.video?.packetsReceived || 0),
            });
        }
    }, [shouldShowButton, callQuality, hasConnectionIssues, hasHighLatency, has3GLevelIssues]);

    const handleZoomClick = () => {
        console.log('[ZoomButton] Zoom button clicked - showing fallback dialog');
        dispatch(showZoomFallbackDialog());
    };

    // Don't render button if connection is stable
    if (!shouldShowButton) {
        return null;
    }

    const tooltipText = (
        <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                Connection issues detected
            </div>
            <div style={{ marginTop: '4px' }}>
                Click to switch to Zoom. Once one person clicks "Join with Zoom", 
                the other person should also click to join the same meeting.
            </div>
        </div>
    );

    return (
        <Tooltip 
            title={tooltipText}
            arrow
            placement="top"
        >
            <button
                onClick={handleZoomClick}
                className="bg-white px-4 py-0.5 text-green rounded-md ml-3 border border-green hover:bg-green hover:border-white hover:text-white animate-pulse"
            >
                zoom
            </button>
        </Tooltip>
    );
};

export default ZoomButton;

