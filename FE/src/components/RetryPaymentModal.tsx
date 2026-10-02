import React, { useState, useEffect } from 'react';
import { notify } from '../utils/notify';
import AdminPaymentDialog, {
  paymentDialogDisabledFieldClass,
  paymentDialogFieldClass,
  paymentDialogHintClass,
  paymentDialogLabelClass,
  paymentDialogPrimaryButtonClass,
  paymentDialogSecondaryButtonClass,
  paymentDialogTextareaClass,
} from './ui/AdminPaymentDialog';

interface RetryPaymentModalProps {
  paymentItem: any;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (customizedPayment: {
    amount: number;
    description: string;
    customerEmail: string;
  }) => void;
}

const RetryPaymentModal: React.FC<RetryPaymentModalProps> = ({
  paymentItem,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [customAmount, setCustomAmount] = useState<number>(0);
  const [customDescription, setCustomDescription] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');

  useEffect(() => {
    if (paymentItem && isOpen) {
      setCustomAmount(paymentItem.amount / 100);
      setCustomDescription(paymentItem.description || '');
      setCustomerEmail(paymentItem.customer?.email || '');
    }
  }, [paymentItem, isOpen]);

  const handleConfirm = () => {
    if (!customAmount || customAmount <= 0) {
      notify.error('Please enter a valid amount');
      return;
    }

    if (!customDescription.trim()) {
      notify.error('Please enter a description');
      return;
    }

    if (!customerEmail.trim()) {
      notify.error('Customer email is required');
      return;
    }

    onConfirm({
      amount: customAmount,
      description: customDescription.trim(),
      customerEmail: customerEmail.trim(),
    });
  };

  return (
    <AdminPaymentDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Customize Retry Payment"
      titleId="retry-payment-title"
      footer={
        <>
          <button type="button" onClick={onClose} className={paymentDialogSecondaryButtonClass}>
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} className={paymentDialogPrimaryButtonClass}>
            Send Payment Link
          </button>
        </>
      }
    >
      <div>
        <label htmlFor="retry-amount" className={paymentDialogLabelClass}>
          Amount ($)
        </label>
        <input
          id="retry-amount"
          type="number"
          value={customAmount}
          onChange={e => setCustomAmount(parseFloat(e.target.value) || 0)}
          className={paymentDialogFieldClass}
          placeholder="Enter amount"
          min="0.01"
          step="0.01"
        />
      </div>

      <div>
        <label htmlFor="retry-description" className={paymentDialogLabelClass}>
          Description
        </label>
        <textarea
          id="retry-description"
          value={customDescription}
          onChange={e => setCustomDescription(e.target.value)}
          className={paymentDialogTextareaClass}
          placeholder="Enter payment description"
          rows={3}
        />
      </div>

      <div>
        <label htmlFor="retry-email" className={paymentDialogLabelClass}>
          Customer Email
        </label>
        <input
          id="retry-email"
          type="email"
          value={customerEmail}
          readOnly
          className={paymentDialogDisabledFieldClass}
          placeholder="Customer email"
        />
        <p className={paymentDialogHintClass}>This email cannot be changed</p>
      </div>
    </AdminPaymentDialog>
  );
};

export default RetryPaymentModal;
