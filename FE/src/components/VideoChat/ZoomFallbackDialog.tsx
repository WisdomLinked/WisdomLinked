/**
 * Day 4: Warning UI Component - Zoom Fallback Dialog
 */

import React from 'react';
import WarningIcon from '@mui/icons-material/Warning';

interface ZoomFallbackDialogProps {
  isOpen: boolean;
  onJoinZoom: () => void;
  onLeaveMeeting: () => void;
  isCreatingMeeting?: boolean;
}

const ZoomFallbackDialog: React.FC<ZoomFallbackDialogProps> = ({
  isOpen,
  onJoinZoom,
  onLeaveMeeting,
  isCreatingMeeting = false,
}) => {
  console.log('[ZoomFallbackDialog] Render called, isOpen:', isOpen, typeof isOpen);
  
  if (!isOpen) {
    console.log('[ZoomFallbackDialog] Not rendering - isOpen is false');
    return null;
  }

  console.log('[ZoomFallbackDialog] Rendering dialog - should be visible now');

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-[99999] animation_fadeIn"
      style={{ 
        position: 'fixed' as const, 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto'
      }}
      onClick={(e) => {
        // Prevent clicks on backdrop from closing
        if (e.target === e.currentTarget) {
          // Optionally close on backdrop click
        }
      }}
    >
      <div className="bg-black border-2 border-teal-500 rounded-lg p-6 max-w-md w-full mx-4 relative shadow-2xl">
          {/* Warning Icon */}
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center">
              <WarningIcon className="text-white text-4xl" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-white text-center mb-2">
            Connection unstable or failed
          </h2>

          {/* Message */}
          <p className="text-gray-300 text-center mb-6">
            Switch to Zoom for a more reliable connection
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col space-y-3">
            <button
              onClick={onJoinZoom}
              disabled={isCreatingMeeting}
              className={`
                w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors
                ${isCreatingMeeting
                  ? 'bg-gray-600 cursor-not-allowed opacity-50'
                  : 'bg-green hover:bg-green-700 active:bg-green-800'
                }
              `}
            >
              {isCreatingMeeting ? 'Creating Meeting...' : 'Join with Zoom (recommended)'}
            </button>

            <button
              onClick={onLeaveMeeting}
              disabled={isCreatingMeeting}
              className={`
                w-full py-3 px-4 rounded-lg font-semibold transition-colors
                ${isCreatingMeeting
                  ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-700 text-white hover:bg-gray-600 active:bg-gray-500'
                }
              `}
            >
              Leave Meeting
            </button>
          </div>
        </div>
      </div>
  );
};

export default ZoomFallbackDialog;

