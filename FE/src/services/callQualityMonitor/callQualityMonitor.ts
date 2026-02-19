/**
 * Day 2: Call Quality Monitoring Module
 * Collects and analyzes WebRTC connection statistics
 */

import { CallQualityMetrics, RTCPeerConnectionStats } from './types';
import Peer from 'simple-peer';

export class CallQualityMonitor {
  private peerConnection: RTCPeerConnection | null = null;
  private peer: Peer.Instance | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private statsCache: Map<string, any> = new Map();
  private readonly MONITORING_INTERVAL_MS = 2000; // Collect stats every 2 seconds
  private onMetricsUpdate: ((metrics: CallQualityMetrics) => void) | null = null;

  constructor(
    peer: Peer.Instance,
    onMetricsUpdate?: (metrics: CallQualityMetrics) => void
  ) {
    this.peer = peer;
    this.onMetricsUpdate = onMetricsUpdate || null;
    this.initializePeerConnection();
  }

  /**
   * Access the underlying RTCPeerConnection from simple-peer
   */
  private initializePeerConnection(): void {
    try {
      // Simple-peer exposes RTCPeerConnection via _pc property
      if (this.peer && (this.peer as any)._pc) {
        this.peerConnection = (this.peer as any)._pc as RTCPeerConnection;
        console.log('[CallQualityMonitor] Peer connection initialized successfully');
      } else {
        console.warn('[CallQualityMonitor] RTCPeerConnection not available yet, will retry', {
          hasPeer: !!this.peer,
          hasPc: !!(this.peer && (this.peer as any)._pc),
        });
        // Retry after a short delay if connection isn't ready (up to 10 times)
        let retryCount = 0;
        const maxRetries = 10;
        const retryInterval = setInterval(() => {
          retryCount++;
          if (this.peer && (this.peer as any)._pc) {
            this.peerConnection = (this.peer as any)._pc as RTCPeerConnection;
            console.log('[CallQualityMonitor] Peer connection initialized after retry');
            clearInterval(retryInterval);
          } else if (retryCount >= maxRetries) {
            console.error('[CallQualityMonitor] Max retries reached for RTCPeerConnection initialization');
            clearInterval(retryInterval);
          }
        }, 500);
      }
    } catch (error) {
      console.error('[CallQualityMonitor] Error accessing RTCPeerConnection:', error);
    }
  }

  /**
   * Start monitoring call quality
   */
  public startMonitoring(): void {
    if (this.monitoringInterval) {
      console.warn('[CallQualityMonitor] Monitoring already started');
      return;
    }

    // Ensure we have peer connection
    if (!this.peerConnection) {
      this.initializePeerConnection();
    }

    if (!this.peerConnection) {
      console.error('[CallQualityMonitor] Cannot start monitoring: RTCPeerConnection not available');
      return;
    }

    console.log('[CallQualityMonitor] Starting call quality monitoring');
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, this.MONITORING_INTERVAL_MS);

    // Collect initial metrics immediately
    this.collectMetrics();
  }

  /**
   * Stop monitoring call quality
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[CallQualityMonitor] Stopped monitoring');
    }
    this.statsCache.clear();
  }

  /**
   * Collect current call quality metrics
   */
  private async collectMetrics(): Promise<void> {
    if (!this.peerConnection) {
      console.warn('[CallQualityMonitor] No peer connection available for stats collection');
      return;
    }

    try {
      console.log('[CallQualityMonitor] Collecting stats from peer connection...');
      const stats = await this.peerConnection.getStats();
      console.log('[CallQualityMonitor] getStats() returned:', {
        statsSize: stats.size,
        hasStats: stats.size > 0,
      });
      
      // Log first few stats entries for debugging
      let count = 0;
      stats.forEach((report, id) => {
        if (count < 5) {
          console.log(`[CallQualityMonitor] Stat entry ${count}:`, {
            id,
            type: (report as any).type,
            kind: (report as any).kind,
            keys: Object.keys(report),
          });
          count++;
        }
      });
      
      const metrics = this.parseStats(stats);
      
      if (metrics && this.onMetricsUpdate) {
        this.onMetricsUpdate(metrics);
      } else {
        console.warn('[CallQualityMonitor] No metrics parsed or no callback');
      }
    } catch (error) {
      console.error('[CallQualityMonitor] Error collecting metrics:', error);
    }
  }

  /**
   * Parse RTCStatsReport into structured metrics
   */
  private parseStats(stats: RTCStatsReport): CallQualityMetrics | null {
    if (!stats || stats.size === 0) {
      return null;
    }

    const metrics: CallQualityMetrics = {
      timestamp: Date.now(),
      audio: {
        packetLoss: 0,
        jitter: 0,
        bitrate: 0,
        packetsReceived: 0,
        packetsLost: 0,
      },
      video: {
        packetLoss: 0,
        jitter: 0,
        bitrate: 0,
        packetsReceived: 0,
        packetsLost: 0,
        framesReceived: 0,
        framesDropped: 0,
      },
      connection: {
        rtt: 0,
        iceConnectionState: this.peerConnection?.iceConnectionState || 'new',
        connectionState: this.peerConnection?.connectionState || 'new',
      },
    };

    // Get connection state directly from peer connection
    if (this.peerConnection) {
      metrics.connection.iceConnectionState = this.peerConnection.iceConnectionState;
      metrics.connection.connectionState = this.peerConnection.connectionState as RTCPeerConnectionState;
    }

    // Debug: Log all stat types we're receiving
    const statTypes = new Set<string>();
    stats.forEach((report) => {
      statTypes.add((report as any).type);
    });
    console.log('[CallQualityMonitor] Available stat types:', Array.from(statTypes));

    // Parse all stats entries
    stats.forEach((report, id) => {
      this.processStatsEntry(report, id, metrics);
    });

    // Calculate packet loss percentages
    this.calculatePacketLoss(metrics);

    // Debug: Log final metrics
    console.log('[CallQualityMonitor] Final metrics:', {
      rtt: metrics.connection.rtt,
      audioPackets: metrics.audio.packetsReceived,
      audioLost: metrics.audio.packetsLost,
      videoPackets: metrics.video.packetsReceived,
      videoLost: metrics.video.packetsLost,
    });

    return metrics;
  }

  /**
   * Process individual stats entry
   */
  private processStatsEntry(
    report: RTCStats,
    id: string,
    metrics: CallQualityMetrics
  ): void {
    const prevReport = this.statsCache.get(id);
    this.statsCache.set(id, report);

    // Cast report to any for type flexibility with RTCStatsType
    const reportAny = report as any;
    const reportType = reportAny.type as string;

    // Handle inbound RTP audio streams
    if (reportType === 'inbound-rtp' && reportAny.kind === 'audio') {
      console.log('[CallQualityMonitor] Found inbound-rtp audio:', {
        packetsReceived: reportAny.packetsReceived,
        packetsLost: reportAny.packetsLost,
        jitter: reportAny.jitter,
        bytesReceived: reportAny.bytesReceived,
      });
      metrics.audio.packetsReceived = reportAny.packetsReceived || 0;
      metrics.audio.packetsLost = reportAny.packetsLost || 0;
      
      if (reportAny.jitter !== undefined) {
        // Convert jitter from seconds to milliseconds
        metrics.audio.jitter = reportAny.jitter * 1000;
      }

      // Calculate bitrate if we have previous stats
      if (prevReport && (prevReport as any).type === 'inbound-rtp') {
        const timeDelta = (report.timestamp - prevReport.timestamp) / 1000; // seconds
        const bytesDelta = (reportAny.bytesReceived || 0) - ((prevReport as any).bytesReceived || 0);
        if (timeDelta > 0) {
          metrics.audio.bitrate = (bytesDelta * 8) / timeDelta; // bits per second
        }
      }
    }

    // Handle inbound RTP video streams
    if (reportType === 'inbound-rtp' && reportAny.kind === 'video') {
      console.log('[CallQualityMonitor] Found inbound-rtp video:', {
        packetsReceived: reportAny.packetsReceived,
        packetsLost: reportAny.packetsLost,
        framesReceived: reportAny.framesReceived,
        framesDropped: reportAny.framesDropped,
        jitter: reportAny.jitter,
        bytesReceived: reportAny.bytesReceived,
      });
      metrics.video.packetsReceived = reportAny.packetsReceived || 0;
      metrics.video.packetsLost = reportAny.packetsLost || 0;
      metrics.video.framesReceived = reportAny.framesReceived || 0;
      metrics.video.framesDropped = reportAny.framesDropped || 0;

      if (reportAny.jitter !== undefined) {
        // Convert jitter from seconds to milliseconds
        metrics.video.jitter = reportAny.jitter * 1000;
      }

      // Calculate bitrate if we have previous stats
      if (prevReport && (prevReport as any).type === 'inbound-rtp') {
        const timeDelta = (report.timestamp - prevReport.timestamp) / 1000; // seconds
        const bytesDelta = (reportAny.bytesReceived || 0) - ((prevReport as any).bytesReceived || 0);
        if (timeDelta > 0) {
          metrics.video.bitrate = (bytesDelta * 8) / timeDelta; // bits per second
        }
      }
    }

    // Handle candidate pair (for RTT)
    if (reportType === 'candidate-pair') {
      console.log('[CallQualityMonitor] Found candidate-pair:', {
        selected: reportAny.selected,
        currentRoundTripTime: reportAny.currentRoundTripTime,
        rtt: reportAny.rtt,
        totalRoundTripTime: reportAny.totalRoundTripTime,
        availableKeys: Object.keys(reportAny),
      });
      
      // Use selected pair if available, otherwise use any pair with RTT data
      // (selected might be undefined in some browsers/versions)
      const isSelected = reportAny.selected === true;
      const hasRTT = reportAny.currentRoundTripTime !== undefined || 
                     reportAny.rtt !== undefined || 
                     reportAny.totalRoundTripTime !== undefined;
      
      if (isSelected || (hasRTT && metrics.connection.rtt === 0)) {
        // Try multiple RTT properties - prefer currentRoundTripTime (most recent)
        const rtt = reportAny.currentRoundTripTime || reportAny.rtt || reportAny.totalRoundTripTime;
        if (rtt !== undefined && rtt > 0) {
          // Convert RTT from seconds to milliseconds
          metrics.connection.rtt = rtt * 1000;
          console.log('[CallQualityMonitor] ✓ Found RTT from candidate-pair:', metrics.connection.rtt, 'ms', 
                     isSelected ? '(selected)' : '(not selected but has RTT)');
        } else {
          console.log('[CallQualityMonitor] ✗ candidate-pair found but no valid RTT value');
        }
      }
    }

    // Handle transport (alternative source for RTT)
    if (reportType === 'transport') {
      console.log('[CallQualityMonitor] Found transport:', {
        rtt: reportAny.rtt,
        currentRoundTripTime: reportAny.currentRoundTripTime,
        availableKeys: Object.keys(reportAny),
      });
      if (metrics.connection.rtt === 0) {
        const rtt = reportAny.rtt || reportAny.currentRoundTripTime;
        if (rtt !== undefined && rtt > 0) {
          metrics.connection.rtt = rtt * 1000; // Convert to ms
          console.log('[CallQualityMonitor] ✓ Found RTT from transport:', metrics.connection.rtt, 'ms');
        } else {
          console.log('[CallQualityMonitor] ✗ transport found but no valid RTT');
        }
      }
    }
  }

  /**
   * Calculate packet loss percentage
   */
  private calculatePacketLoss(metrics: CallQualityMetrics): void {
    // Audio packet loss
    const totalAudioPackets = metrics.audio.packetsReceived + metrics.audio.packetsLost;
    if (totalAudioPackets > 0) {
      metrics.audio.packetLoss = (metrics.audio.packetsLost / totalAudioPackets) * 100;
    }

    // Video packet loss
    const totalVideoPackets = metrics.video.packetsReceived + metrics.video.packetsLost;
    if (totalVideoPackets > 0) {
      metrics.video.packetLoss = (metrics.video.packetsLost / totalVideoPackets) * 100;
    }
  }

  /**
   * Get current peer connection state
   */
  public getConnectionState(): {
    iceConnectionState: RTCIceConnectionState;
    connectionState: RTCPeerConnectionState;
  } | null {
    if (!this.peerConnection) {
      return null;
    }

    return {
      iceConnectionState: this.peerConnection.iceConnectionState,
      connectionState: this.peerConnection.connectionState as RTCPeerConnectionState,
    };
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stopMonitoring();
    this.peerConnection = null;
    this.peer = null;
    this.onMetricsUpdate = null;
    this.statsCache.clear();
  }
}

