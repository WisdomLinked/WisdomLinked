/**
 * Day 3: Failure Detection Logic with Debounce and Recovery
 * Detects unstable calls based on quality metrics with debounce to prevent false positives
 */

import {
  CallQualityMetrics,
  CallInstabilityThresholds,
  CallQualityStatus,
  CallQualityState,
} from './types';

export class FailureDetector {
  private state: CallQualityState;
  private onStatusChange: ((status: CallQualityStatus) => void) | null = null;
  private violationCheckTimer: NodeJS.Timeout | null = null;
  private recoveryCheckTimer: NodeJS.Timeout | null = null;

  constructor(
    thresholds: Partial<CallInstabilityThresholds> = {},
    onStatusChange?: (status: CallQualityStatus) => void
  ) {
    const defaultThresholds: CallInstabilityThresholds = {
      audioPacketLoss: 5, // 5%
      videoPacketLoss: 10, // 10%
      rtt: 500, // 500ms
      audioJitter: 50, // 50ms
      videoJitter: 100, // 100ms
      minAudioBitrate: 20000, // 20kbps
      minVideoBitrate: 200000, // 200kbps
      violationDuration: 3000, // 3 seconds
      debounceWindow: 5000, // 5 seconds
      recoveryWindow: 10000, // 10 seconds
    };

    this.state = {
      status: CallQualityStatus.STABLE,
      currentMetrics: null,
      metricsHistory: [],
      instabilityDetected: false,
      lastInstabilityTime: null,
      violationStartTime: null,
      recoveryStartTime: null,
      thresholds: { ...defaultThresholds, ...thresholds },
    };

    this.onStatusChange = onStatusChange || null;
  }

  /**
   * Process new metrics and update state
   */
  public processMetrics(metrics: CallQualityMetrics): void {
    this.state.currentMetrics = metrics;
    
    // Keep only last 10 metrics for history
    this.state.metricsHistory.push(metrics);
    if (this.state.metricsHistory.length > 10) {
      this.state.metricsHistory.shift();
    }

    // Check for immediate failures (ICE connection failed/disconnected)
    if (this.checkImmediateFailure(metrics)) {
      this.triggerInstability(CallQualityStatus.FAILED);
      return;
    }

    // Check for threshold violations
    const violations = this.checkThresholdViolations(metrics);

    if (violations.length > 0) {
      this.handleViolations(violations);
    } else {
      this.handleRecovery();
    }
  }

  /**
   * Check for immediate connection failures (no debounce needed)
   */
  private checkImmediateFailure(metrics: CallQualityMetrics): boolean {
    const { iceConnectionState, connectionState } = metrics.connection;

    // Immediate failure states
    if (iceConnectionState === 'failed' || iceConnectionState === 'disconnected') {
      return true;
    }

    if (connectionState === 'failed' || connectionState === 'disconnected') {
      return true;
    }

    // Connection attempt timeout (checking for too long)
    // Note: RTCIceConnectionState valid values are: "new", "checking", "connected", "completed", "failed", "disconnected", "closed"
    if (iceConnectionState === 'checking') {
      const checkingDuration = Date.now() - (this.state.violationStartTime || Date.now());
      if (checkingDuration > 10000) { // 10 seconds
        return true;
      }
    }

    return false;
  }

  /**
   * Check if metrics violate thresholds
   */
  private checkThresholdViolations(metrics: CallQualityMetrics): string[] {
    const violations: string[] = [];
    const { thresholds } = this.state;

    // Audio packet loss violation
    if (metrics.audio.packetLoss > thresholds.audioPacketLoss) {
      violations.push('audioPacketLoss');
    }

    // Video packet loss violation
    if (metrics.video.packetLoss > thresholds.videoPacketLoss) {
      violations.push('videoPacketLoss');
    }

    // RTT violation
    if (metrics.connection.rtt > thresholds.rtt) {
      violations.push('rtt');
    }

    // Audio jitter violation
    if (metrics.audio.jitter > thresholds.audioJitter) {
      violations.push('audioJitter');
    }

    // Video jitter violation
    if (metrics.video.jitter > thresholds.videoJitter) {
      violations.push('videoJitter');
    }

    // Audio bitrate violation
    if (metrics.audio.bitrate > 0 && metrics.audio.bitrate < thresholds.minAudioBitrate) {
      violations.push('audioBitrate');
    }

    // Video bitrate violation
    if (metrics.video.bitrate > 0 && metrics.video.bitrate < thresholds.minVideoBitrate) {
      violations.push('videoBitrate');
    }

    return violations;
  }

  /**
   * Handle threshold violations with debounce logic
   */
  private handleViolations(violations: string[]): void {
    const now = Date.now();
    const { violationDuration, debounceWindow } = this.state.thresholds;

    // If this is the first violation, record the start time
    if (!this.state.violationStartTime) {
      this.state.violationStartTime = now;
      this.state.status = CallQualityStatus.MONITORING;
      console.log('[FailureDetector] Violations detected, starting monitoring:', violations);
    }

    const violationDurationElapsed = now - this.state.violationStartTime;

    // If violations persist beyond the debounce window, trigger instability
    if (violationDurationElapsed >= debounceWindow) {
      // Check if violations have been sustained for the required duration
      const sustainedViolations = this.checkSustainedViolations(violationDuration);
      
      if (sustainedViolations) {
        this.triggerInstability(CallQualityStatus.UNSTABLE);
      }
    }
  }

  /**
   * Check if violations have been sustained for the required duration
   */
  private checkSustainedViolations(requiredDuration: number): boolean {
    if (this.state.metricsHistory.length < 2) {
      return false;
    }

    // Check last few metrics to see if violations are sustained
    const recentMetrics = this.state.metricsHistory.slice(-3); // Last 3 measurements
    const now = Date.now();
    const startTime = now - requiredDuration;

    // Count how many recent metrics show violations
    let violationCount = 0;
    for (const metrics of recentMetrics) {
      if (metrics.timestamp >= startTime) {
        const violations = this.checkThresholdViolations(metrics);
        if (violations.length > 0) {
          violationCount++;
        }
      }
    }

    // Consider sustained if > 50% of recent metrics show violations
    return violationCount >= Math.ceil(recentMetrics.length * 0.5);
  }

  /**
   * Handle recovery (metrics back to normal)
   */
  private handleRecovery(): void {
    const { status, thresholds } = this.state;
    const { recoveryWindow } = thresholds;

    // If we're in an unstable state, start recovery timer
    if (status === CallQualityStatus.UNSTABLE || status === CallQualityStatus.MONITORING) {
      if (!this.state.recoveryStartTime) {
        this.state.recoveryStartTime = Date.now();
        this.state.status = CallQualityStatus.RECOVERING;
        console.log('[FailureDetector] Metrics recovered, monitoring for stability');
      }

      const recoveryDuration = Date.now() - this.state.recoveryStartTime;

      // If stable for the recovery window, confirm recovery
      if (recoveryDuration >= recoveryWindow) {
        this.confirmRecovery();
      }
    } else {
      // If already stable, reset violation tracking
      this.state.violationStartTime = null;
      this.state.recoveryStartTime = null;
    }
  }

  /**
   * Trigger instability detection
   */
  private triggerInstability(newStatus: CallQualityStatus): void {
    if (this.state.status !== newStatus) {
      const previousStatus = this.state.status;
      this.state.status = newStatus;
      this.state.instabilityDetected = true;
      this.state.lastInstabilityTime = Date.now();

      console.log(
        `[FailureDetector] Status changed: ${previousStatus} → ${newStatus}`,
        this.state.currentMetrics
      );

      // Notify listener
      if (this.onStatusChange) {
        this.onStatusChange(newStatus);
      }
    }
  }

  /**
   * Confirm recovery and return to stable state
   */
  private confirmRecovery(): void {
    const previousStatus = this.state.status;
    this.state.status = CallQualityStatus.STABLE;
    this.state.instabilityDetected = false;
    this.state.violationStartTime = null;
    this.state.recoveryStartTime = null;

    console.log(
      `[FailureDetector] Connection recovered: ${previousStatus} → ${CallQualityStatus.STABLE}`
    );

    // Notify listener
    if (this.onStatusChange) {
      this.onStatusChange(CallQualityStatus.STABLE);
    }
  }

  /**
   * Get current state
   */
  public getState(): CallQualityState {
    return { ...this.state };
  }

  /**
   * Get current status
   */
  public getStatus(): CallQualityStatus {
    return this.state.status;
  }

  /**
   * Check if instability is currently detected
   */
  public isUnstable(): boolean {
    return (
      this.state.status === CallQualityStatus.UNSTABLE ||
      this.state.status === CallQualityStatus.FAILED
    );
  }

  /**
   * Reset detector state
   */
  public reset(): void {
    this.state = {
      ...this.state,
      status: CallQualityStatus.STABLE,
      currentMetrics: null,
      metricsHistory: [],
      instabilityDetected: false,
      lastInstabilityTime: null,
      violationStartTime: null,
      recoveryStartTime: null,
    };
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.violationCheckTimer) {
      clearTimeout(this.violationCheckTimer);
    }
    if (this.recoveryCheckTimer) {
      clearTimeout(this.recoveryCheckTimer);
    }
    this.onStatusChange = null;
    this.reset();
  }
}

