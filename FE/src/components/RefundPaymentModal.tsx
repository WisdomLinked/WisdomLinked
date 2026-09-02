import React, { useState, useEffect } from "react";
import CloseIcon from '@mui/icons-material/Close';
import { store } from '../store';
import { showErrorAlert } from '../actions/alertActions';

interface RefundPaymentModalProps {
    paymentItem: any;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (refundData: {
        amount: number;
        reason: string;
    }) => void;
}

const RefundPaymentModal: React.FC<RefundPaymentModalProps> = ({
    paymentItem,
    isOpen,
    onClose,
    onConfirm
}) => {
    const [refundAmount, setRefundAmount] = useState<number>(0);
    const [refundReason, setRefundReason] = useState<string>('');
    const [maxRefundAmount, setMaxRefundAmount] = useState<number>(0);

    useEffect(() => {
        if (paymentItem && isOpen) {
            const maxAmount = paymentItem.amount / 100;
            setMaxRefundAmount(maxAmount);
            setRefundAmount(maxAmount); // Default to full refund
            setRefundReason('');
        }
    }, [paymentItem, isOpen]);

    const handleConfirm = () => {
        if (!refundAmount || refundAmount <= 0) {
            store.dispatch(showErrorAlert('Please enter a valid refund amount'));
            return;
        }
        
        if (refundAmount > maxRefundAmount) {
            store.dispatch(showErrorAlert(`Refund amount cannot exceed $${maxRefundAmount.toFixed(2)}`));
            return;
        }
        
        if (!refundReason.trim()) {
            store.dispatch(showErrorAlert('Please provide a reason for the refund'));
            return;
        }

        onConfirm({
            amount: refundAmount,
            reason: refundReason.trim()
        });
    };

    if (!isOpen || !paymentItem) return null;

    return (
        <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div 
                className="absolute top-0 left-0 w-full h-full cursor-pointer"
                onClick={onClose}
            />
            <div className="relative bg-black border border-lightgrey rounded-lg w-full max-w-md p-6 text-white">
                <button 
                    className="absolute right-2 top-2 rounded-md hover:bg-grey p-1"
                    onClick={onClose}
                >
                    <CloseIcon fontSize="small" />
                </button>
                
                <h2 className="text-xl font-semibold mb-6 text-center">Process Refund</h2>
                
                <div className="space-y-4">
                    <div className="bg-grey/20 p-4 rounded-lg">
                        <h3 className="text-sm font-medium mb-2">Payment Details</h3>
                        <div className="text-sm text-grey space-y-1">
                            <p><span className="font-medium">Original Amount:</span> ${(paymentItem.amount / 100).toFixed(2)} {paymentItem.currency?.toUpperCase()}</p>
                            <p><span className="font-medium">Customer:</span> {paymentItem.customer?.email || 'N/A'}</p>
                            <p><span className="font-medium">Description:</span> {paymentItem.description || 'N/A'}</p>
                            <p><span className="font-medium">Payment Intent:</span> {paymentItem.paymentIntent || 'N/A'}</p>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-grey mb-1 text-sm">Refund Amount ($)</label>
                        <input
                            type="number"
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                            className="w-full rounded-lg h-12 bg-transparent border border-lightgrey text-white px-4 text-sm focus:outline-none focus:border-red-500"
                            placeholder="Enter refund amount"
                            min="0.01"
                            max={maxRefundAmount}
                            step="0.01"
                        />
                        <p className="text-xs text-grey mt-1">Maximum refundable: ${maxRefundAmount.toFixed(2)}</p>
                    </div>
                    
                    <div>
                        <label className="block text-grey mb-1 text-sm">Reason for Refund</label>
                        <textarea
                            value={refundReason}
                            onChange={(e) => setRefundReason(e.target.value)}
                            className="w-full rounded-lg bg-transparent border border-lightgrey text-white px-4 py-3 text-sm focus:outline-none focus:border-red-500 resize-none"
                            placeholder="Please provide a reason for this refund..."
                            rows={3}
                        />
                    </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-transparent border border-lightgrey text-white py-2 px-4 rounded-lg hover:bg-grey/20 transition-colors text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium"
                    >
                        Process Refund
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RefundPaymentModal;