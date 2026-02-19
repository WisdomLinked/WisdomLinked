/**
 * Day 4-5: Hook to integrate call quality monitoring with VideoChat
 */

import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useAppSelector } from '../../store';
import { CallQualityMonitor, FailureDetector, CallQualityStatus } from '../../services/callQualityMonitor';
import {
  setCallQualityStatus,
  setCallQualityMetrics,
  setCallInstability,
  showZoomFallbackDialog,
} from '../../actions/callQualityActions';
import { currentPeerConnection } from '../../socket/socketConnection';
import Peer from 'simple-peer';

export const useCallQualityMonitor = (isCallActive: boolean) => {
  const dispatch = useDispatch();
  const monitorRef = useRef<CallQualityMonitor | null>(null);
  const detectorRef = useRef<FailureDetector | null>(null);
  const { callQuality } = useAppSelector((state) => state);

  useEffect(() => {
    if (!isCallActive) {
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

    // Get peer connection from socket connection
    // Note: This assumes currentPeerConnection is accessible
    // You may need to adjust based on your architecture
    const peerConnection = currentPeerConnection;
    
    if (!peerConnection) {
      console.warn('[useCallQualityMonitor] Peer connection not available');
      return;
    }

    // Initialize failure detector
    const detector = new FailureDetector(
      {
        audioPacketLoss: 5,
        videoPacketLoss: 10,
        rtt: 500,
        audioJitter: 50,
        videoJitter: 100,
        violationDuration: 3000,
        debounceWindow: 5000,
        recoveryWindow: 10000,
      },
      (status) => {
        dispatch(setCallQualityStatus(status));
        
        // Show dialog when unstable or failed
        if (status === CallQualityStatus.UNSTABLE || status === CallQualityStatus.FAILED) {
          dispatch(setCallInstability(true));
          dispatch(showZoomFallbackDialog());
        }
      }
    );
    detectorRef.current = detector;

    // Initialize monitor
    const monitor = new CallQualityMonitor(
      peerConnection as Peer.Instance,
      (metrics) => {
        dispatch(setCallQualityMetrics(metrics));
        detector.processMetrics(metrics);
      }
    );
    monitorRef.current = monitor;

    // Start monitoring
    monitor.startMonitoring();

    // Cleanup function
    return () => {
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
  }, [isCallActive, dispatch]);

  return {
    status: callQuality.status,
    metrics: callQuality.metrics,
    instabilityDetected: callQuality.instabilityDetected,
  };
};


