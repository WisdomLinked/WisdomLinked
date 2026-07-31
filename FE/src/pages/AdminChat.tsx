import React from 'react';
import StudentChat from '../components/dashboard/StudentChat';

/**
 * Admin chat: same shell as expert ModernChat — light panel + Messenger theme="light".
 */
export default function AdminChat() {
  return (
    <div className="h-[calc(100vh-56px)] min-h-0 bg-wl-page">
      <StudentChat />
    </div>
  );
}
