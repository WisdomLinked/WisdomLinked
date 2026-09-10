import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { store } from '../store';
import { showErrorAlert } from '../actions/alertActions';
import { OVERLAY_Z_DIALOG } from '../utils/overlayLayers';

interface AdHocPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentData: {
    amount: number;
    description: string;
    customerEmail: string;
    customerName?: string;
  }) => void;
}

const fieldClass =
  'h-11 w-full rounded-xl border border-wl-line bg-white px-3 text-sm text-wl-ink outline-none placeholder:text-wl-muted focus:border-wl-brand focus:ring-2 focus:ring-wl-brand/40';

const AdHocPaymentModal: React.FC<AdHocPaymentModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setAmount(0);
    setDescription('');
    setCustomerEmail('');
    setCustomerName('');
  }, [isOpen]);

  const handleClose = () => {
    setAmount(0);
    setDescription('');
    setCustomerEmail('');
    setCustomerName('');
    onClose();
  };

  const handleConfirm = () => {
    if (!amount || amount <= 0) {
      store.dispatch(showErrorAlert('Please enter a valid amount greater than $0'));
      return;
    }

    if (!description.trim()) {
      store.dispatch(showErrorAlert('Please enter a payment description'));
      return;
    }

    if (!customerEmail.trim()) {
      store.dispatch(showErrorAlert('Please enter customer email address'));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail.trim())) {
      store.dispatch(showErrorAlert('Please enter a valid email address'));
      return;
    }

    onConfirm({
      amount,
      description: description.trim(),
      customerEmail: customerEmail.trim(),
      customerName: customerName.trim() || undefined,
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: OVERLAY_Z_DIALOG }}>
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[4px]"
        aria-label="Close ad-hoc payment"
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="adhoc-payment-title"
        className="relative w-full max-w-md rounded-2xl border border-wl-line bg-wl-card p-6 text-wl-ink shadow-[0_20px_50px_rgba(26,58,74,0.15)]"
      >
        <button
          type="button"
          className="absolute right-4 top-4 rounded-lg p-1 text-wl-muted hover:bg-wl-pageAlt hover:text-wl-ink"
          aria-label="Close"
          onClick={handleClose}
        >
          <X className="h-5 w-5" />
        </button>

        <h2 id="adhoc-payment-title" className="pr-8 text-lg font-semibold text-wl-brand">
          Send ad-hoc payment
        </h2>
        <p className="mt-1 text-sm text-wl-muted">
          Send a payment link to a customer. This is not tied to a booking.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="adhoc-amount" className="mb-1 block text-[12px] font-medium text-wl-ink">
              Amount ($)
            </label>
            <input
              id="adhoc-amount"
              type="number"
              value={amount || ''}
              onChange={e => setAmount(parseFloat(e.target.value) || 0)}
              className={fieldClass}
              placeholder="0.00"
              min="0.01"
              step="0.01"
            />
          </div>

          <div>
            <label htmlFor="adhoc-description" className="mb-1 block text-[12px] font-medium text-wl-ink">
              Payment description
            </label>
            <textarea
              id="adhoc-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="min-h-[88px] w-full resize-none rounded-xl border border-wl-line bg-white px-3 py-2.5 text-sm text-wl-ink outline-none placeholder:text-wl-muted focus:border-wl-brand focus:ring-2 focus:ring-wl-brand/40"
              placeholder="What this payment is for"
              rows={3}
            />
          </div>

          <div>
            <label htmlFor="adhoc-email" className="mb-1 block text-[12px] font-medium text-wl-ink">
              Customer email
            </label>
            <input
              id="adhoc-email"
              type="email"
              value={customerEmail}
              onChange={e => setCustomerEmail(e.target.value)}
              className={fieldClass}
              placeholder="customer@example.com"
            />
          </div>

          <div>
            <label htmlFor="adhoc-name" className="mb-1 block text-[12px] font-medium text-wl-ink">
              Customer name <span className="font-normal text-wl-muted">(optional)</span>
            </label>
            <input
              id="adhoc-name"
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              className={fieldClass}
              placeholder="Full name"
            />
            <p className="mt-1 text-[11px] text-wl-muted">Used for record keeping only.</p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-wl-line bg-wl-brandSoft/50 px-4 py-3">
          <h3 className="text-sm font-medium text-wl-ink">What happens next</h3>
          <ul className="mt-1.5 space-y-1 text-[12px] text-wl-muted">
            <li>A payment link is emailed to the customer.</li>
            <li>They receive a confirmation after they pay.</li>
          </ul>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="h-10 rounded-lg border border-wl-line bg-white px-4 text-sm font-medium text-wl-ink hover:bg-wl-pageAlt"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="h-10 rounded-lg bg-wl-brand px-4 text-sm font-medium text-white hover:brightness-95"
          >
            Send payment link
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AdHocPaymentModal;
