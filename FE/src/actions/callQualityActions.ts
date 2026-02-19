/**
 * Day 4-5: Call Quality Actions
 */

import { Dispatch } from 'redux';
import { actionTypes } from './types';
import { CallQualityStatus, CallQualityMetrics } from '../services/callQualityMonitor/types';

// Set call quality status
export const setCallQualityStatus = (status: CallQualityStatus) => {
  return {
    type: actionTypes.setCallQualityStatus,
    payload: { status },
  };
};

// Set call quality metrics
export const setCallQualityMetrics = (metrics: CallQualityMetrics | null) => {
  return {
    type: actionTypes.setCallQualityMetrics,
    payload: { metrics },
  };
};

// Set call instability detected
export const setCallInstability = (instabilityDetected: boolean) => {
  return {
    type: actionTypes.setCallInstability,
    payload: { instabilityDetected },
  };
};

// Show Zoom fallback dialog
export const showZoomFallbackDialog = () => {
  console.log('[showZoomFallbackDialog action] Dispatching action, type:', actionTypes.showZoomFallbackDialog);
  return {
    type: actionTypes.showZoomFallbackDialog,
  };
};

// Hide Zoom fallback dialog
export const hideZoomFallbackDialog = () => {
  return {
    type: actionTypes.hideZoomFallbackDialog,
  };
};

// Set Zoom meeting details
export const setZoomMeetingDetails = (meetingDetails: {
  meetingId?: string;
  joinUrl?: string;
  password?: string;
  meetingNumber?: string;
} | null) => {
  return {
    type: actionTypes.setZoomMeetingDetails,
    payload: { meetingDetails },
  };
};

