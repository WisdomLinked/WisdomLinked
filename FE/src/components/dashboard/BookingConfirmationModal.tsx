import React from 'react';
import { X } from 'lucide-react';

export type BookingConfirmationDetails = {
  date: string;
  timeRange: string;
  timeZone: string;
  sessionType: string;
  expertName: string;
  sessionLengthMinutes: number;
  price: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  details: BookingConfirmationDetails;
};

export default function BookingConfirmationModal({
  open,
  onClose,
  onConfirm,
  details,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#1A3A4A]/40 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-confirmation-title"
        data-testid="booking-confirmation-modal"
        className="relative w-full max-w-md rounded-2xl border border-[#E5E2DB] bg-white p-6 shadow-[0_20px_50px_rgba(26,58,74,0.15)]"
      >
        <button
          type="button"
          className="absolute right-4 top-4 rounded-lg p-1 text-[#7A7A72] hover:bg-[#F5F3EF]"
          aria-label="Close"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>

        <h3
          id="booking-confirmation-title"
          className="font-serif text-lg font-medium text-[#1A3A4A] pr-8"
        >
          Confirm your booking
        </h3>
        <p className="mt-1 text-[12px] text-[#7A7A72]">
          Review the details below before proceeding to payment.
        </p>

        <dl className="mt-4 space-y-2 text-sm text-[#1A3A4A]">
          <div className="flex justify-between gap-2">
            <dt className="text-[#7A7A72]">Date</dt>
            <dd className="font-semibold text-right">{details.date}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[#7A7A72]">Time</dt>
            <dd className="font-semibold text-right">{details.timeRange}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[#7A7A72]">Timezone</dt>
            <dd className="font-semibold text-right">{details.timeZone}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[#7A7A72]">Session type</dt>
            <dd className="font-semibold text-right">{details.sessionType}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[#7A7A72]">Expert</dt>
            <dd className="font-semibold text-right">{details.expertName}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[#7A7A72]">Appointment duration</dt>
            <dd className="font-semibold text-right">{details.sessionLengthMinutes} min</dd>
          </div>
          <div className="flex justify-between gap-2 border-t border-[#E5E2DB] pt-2">
            <dt className="text-[#7A7A72]">Price</dt>
            <dd className="font-serif text-lg font-semibold">
              ${details.price.toFixed(2)}
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex w-full items-center justify-center rounded-[4px] bg-[#1A3A4A] px-4 py-3 text-[13px] font-semibold text-white hover:bg-[#122635]"
          >
            Proceed to payment
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center rounded-[4px] border border-[#E5E2DB] bg-white px-4 py-3 text-[13px] font-semibold text-[#1A3A4A] hover:bg-[#F5F3EF]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
