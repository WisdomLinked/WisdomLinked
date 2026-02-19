/**
 * Day 1: Type definitions for Call Quality Monitoring
 */

export interface CallQualityMetrics {
  // Timestamp of this metric snapshot
  timestamp: number;
  
  // Audio metrics
  audio: {
    packetLoss: number; // Percentage (0-100)
    jitter: number; // Milliseconds
    bitrate: number; // Bits per second
    packetsReceived: number;
    packetsLost: number;
  };
  
  // Video metrics
  video: {
    packetLoss: number; // Percentage (0-100)
    jitter: number; // Milliseconds
    bitrate: number; // Bits per second
    packetsReceived: number;
    packetsLost: number;
    framesReceived: number;
    framesDropped: number;
  };
  
  // Connection metrics
  connection: {
    rtt: number; // Round trip time in milliseconds
    iceConnectionState: RTCIceConnectionState;
    connectionState: RTCPeerConnectionState;
  };
}

export interface CallInstabilityThresholds {
  // Primary thresholds
  audioPacketLoss: number; // Default: 5%
  videoPacketLoss: number; // Default: 10%
  rtt: number; // Default: 500ms
  audioJitter: number; // Default: 50ms
  videoJitter: number; // Default: 100ms
  
  // Secondary thresholds
  minAudioBitrate: number; // Default: 20000 bps (20kbps)
  minVideoBitrate: number; // Default: 200000 bps (200kbps)
  
  // Timing thresholds
  violationDuration: number; // Duration in ms to consider violation sustained (Default: 3000ms)
  debounceWindow: number; // Debounce window in ms (Default: 5000ms)
  recoveryWindow: number; // Duration in ms for recovery confirmation (Default: 10000ms)
}

export enum CallQualityStatus {
  STABLE = 'STABLE',
  MONITORING = 'MONITORING',
  UNSTABLE = 'UNSTABLE',
  RECOVERING = 'RECOVERING',
  FAILED = 'FAILED',
}

export interface CallQualityState {
  status: CallQualityStatus;
  currentMetrics: CallQualityMetrics | null;
  metricsHistory: CallQualityMetrics[];
  instabilityDetected: boolean;
  lastInstabilityTime: number | null;
  violationStartTime: number | null;
  recoveryStartTime: number | null;
  thresholds: CallInstabilityThresholds;
}

export interface RTCPeerConnectionStats {
  audio?: {
    packetsReceived?: number;
    packetsLost?: number;
    jitter?: number;
    bitrate?: number;
  };
  video?: {
    packetsReceived?: number;
    packetsLost?: number;
    jitter?: number;
    bitrate?: number;
    framesReceived?: number;
    framesDropped?: number;
  };
  connection?: {
    rtt?: number;
    iceConnectionState?: RTCIceConnectionState;
    connectionState?: RTCPeerConnectionState;
  };
}


