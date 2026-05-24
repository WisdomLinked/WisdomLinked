import React from 'react';
import { Navigate, type ToolbarProps } from 'react-big-calendar';

/**
 * Month-only navigation for student booking calendar (no Month/Day/Week switcher).
 */
export default function StudentBookingToolbar({
  label,
  onNavigate,
}: ToolbarProps) {
  return (
    <div className="rbc-toolbar mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="rbc-btn-group flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onNavigate(Navigate.PREVIOUS)}
          className="rounded-[4px] border border-[#E5E2DB] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1A3A4A] hover:bg-[#F5F3EF]"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => onNavigate(Navigate.TODAY)}
          className="rounded-[4px] border border-[#E5E2DB] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1A3A4A] hover:bg-[#F5F3EF]"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => onNavigate(Navigate.NEXT)}
          className="rounded-[4px] border border-[#E5E2DB] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1A3A4A] hover:bg-[#F5F3EF]"
        >
          Next
        </button>
      </div>
      <span className="rbc-toolbar-label font-serif text-[15px] font-semibold text-[#1A3A4A]">
        {label}
      </span>
    </div>
  );
}
