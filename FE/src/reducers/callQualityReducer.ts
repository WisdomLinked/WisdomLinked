/**
 * Day 4-5: Call Quality Reducer
 */

import { Reducer } from 'redux';
import { actionTypes } from '../actions/types';
import { CallQualityStatus, CallQualityMetrics } from '../services/callQualityMonitor/types';

export interface CallQualityState {
  status: CallQualityStatus;
  metrics: CallQualityMetrics | null;
  instabilityDetected: boolean;
  showZoomFallbackDialog: boolean;
  zoomMeetingDetails: {
    meetingId?: string;
    joinUrl?: string;
    password?: string;
    meetingNumber?: string;
  } | null;
  isCreatingZoomMeeting: boolean;
}

const initialState: CallQualityState = {
  status: CallQualityStatus.STABLE,
  metrics: null,
  instabilityDetected: false,
  showZoomFallbackDialog: false,
  zoomMeetingDetails: null,
  isCreatingZoomMeeting: false,
};

const callQualityReducer: Reducer<CallQualityState> = (
  state = initialState,
  action: any
) => {
  // Debug logging
  if (action.type === actionTypes.showZoomFallbackDialog || action.type === actionTypes.hideZoomFallbackDialog) {
    console.log('[callQualityReducer] Action received:', {
      type: action.type,
      actionTypeValue: actionTypes.showZoomFallbackDialog,
      match: action.type === actionTypes.showZoomFallbackDialog,
      currentState: state.showZoomFallbackDialog
    });
  }

  switch (action.type) {
    case actionTypes.setCallQualityStatus:
      return {
        ...state,
        status: action.payload.status,
      };

    case actionTypes.setCallQualityMetrics:
      return {
        ...state,
        metrics: action.payload.metrics,
      };

    case actionTypes.setCallInstability:
      return {
        ...state,
        instabilityDetected: action.payload.instabilityDetected,
      };

    case actionTypes.showZoomFallbackDialog:
      console.log('[callQualityReducer] Setting showZoomFallbackDialog to true');
      return {
        ...state,
        showZoomFallbackDialog: true,
      };

    case actionTypes.hideZoomFallbackDialog:
      console.log('[callQualityReducer] Setting showZoomFallbackDialog to false');
      return {
        ...state,
        showZoomFallbackDialog: false,
      };

    case actionTypes.setZoomMeetingDetails:
      return {
        ...state,
        zoomMeetingDetails: action.payload.meetingDetails,
        isCreatingZoomMeeting: false,
      };

    default:
      return state;
  }
};

export default callQualityReducer;

