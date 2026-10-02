import React, { useState, useEffect } from 'react';
import { notify } from '../utils/notify';
import AdminPaymentDialog, {
  paymentDialogDangerButtonClass,
  paymentDialogFieldClass,
  paymentDialogHintClass,
  paymentDialogLabelClass,
  paymentDialogSecondaryButtonClass,
  paymentDialogTextareaClass,
} from './ui/AdminPaymentDialog';

interface RefundPaymentModalProps {
  paymentItem: any;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (refundData: { amount: number; reason: string }) => void;
}

const RefundPaymentModal: React.FC<RefundPaymentModalProps> = ({
  paymentItem,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundReason, setRefundReason] = useState<string>('');
  const [maxRefundAmount, setMaxRefundAmount] = useState<number>(0);

  useEffect(() => {
    if (paymentItem && isOpen) {
      const maxAmount = paymentItem.amount / 100;
      setMaxRefundAmount(maxAmount);
      setRefundAmount(maxAmount);
      setRefundReason('');
    }
  }, [paymentItem, isOpen]);

  const handleConfirm = () => {
    if (!refundAmount || refundAmount <= 0) {
      notify.error('Please enter a valid refund amount');
      return;
    }

    if (refundAmount > maxRefundAmount) {
      notify.error(`Refund amount cannot exceed $${maxRefundAmount.toFixed(2)}`);
      return;
    }

    if (!refundReason.trim()) {
      notify.error('Please provide a reason for the refund');
      return;
    }

    onConfirm({
      amount: refundAmount,
      reason: refundReason.trim(),
    });
  };

  return (
    <AdminPaymentDialog
      isOpen={isOpen && Boolean(paymentItem)}
      onClose={onClose}
      title="Process Refund"
      titleId="refund-payment-title"
      footer={
        <>
          <button type="button" onClick={onClose} className={paymentDialogSecondaryButtonClass}>
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} className={paymentDialogDangerButtonClass}>
            Process Refund
          </button>
        </>
      }
    >
      {paymentItem ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="mb-2 text-sm font-medium text-slate-800">Payment Details</h3>
          <div className="space-y-1 text-sm text-slate-600">
            <p>
              <span className="font-medium text-slate-700">Original Amount:</span>{' '}
              ${(paymentItem.amount / 100).toFixed(2)} {paymentItem.currency?.toUpperCase()}
            </p>
            <p>
              <span className="font-medium text-slate-700">Customer:</span>{' '}
              {paymentItem.customer?.email || 'N/A'}
            </p>
            <p>
              <span className="font-medium text-slate-700">Description:</span>{' '}
              {paymentItem.description || 'N/A'}
            </p>
            <p>
              <span className="font-medium text-slate-700">Payment Intent:</span>{' '}
              {paymentItem.paymentIntent || 'N/A'}
            </p>
          </div>
        </div>
      ) : null}

      <div>
        <label htmlFor="refund-amount" className={paymentDialogLabelClass}>
          Refund Amount ($)
        </label>
        <input
          id="refund-amount"
          type="number"
          value={refundAmount}
          onChange={e => setRefundAmount(parseFloat(e.target.value) || 0)}
          className={paymentDialogFieldClass}
          placeholder="Enter refund amount"
          min="0.01"
          max={maxRefundAmount}
          step="0.01"
        />
        <p className={paymentDialogHintClass}>Maximum refundable: ${maxRefundAmount.toFixed(2)}</p>
      </div>

      <div>
        <label htmlFor="refund-reason" className={paymentDialogLabelClass}>
          Reason for Refund
        </label>
        <textarea
          id="refund-reason"
          value={refundReason}
          onChange={e => setRefundReason(e.target.value)}
          className={paymentDialogTextareaClass}
          placeholder="Please provide a reason for this refund..."
          rows={3}
        />
      </div>
    </AdminPaymentDialog>
  );
};

export default RefundPaymentModal;
