import React, { useState, useEffect } from "react";
import CloseIcon from '@mui/icons-material/Close';

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
    onConfirm
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
            alert('Please enter a valid amount');
            return;
        }
        
        if (!customDescription.trim()) {
            alert('Please enter a description');
            return;
        }

        if (!customerEmail.trim()) {
            alert('Customer email is required');
            return;
        }

        onConfirm({
            amount: customAmount,
            description: customDescription.trim(),
            customerEmail: customerEmail.trim()
        });
    };

    if (!isOpen) return null;

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
                
                <h2 className="text-xl font-semibold mb-6 text-center">Customize Retry Payment</h2>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-grey mb-1 text-sm">Amount ($)</label>
                        <input
                            type="number"
                            value={customAmount}
                            onChange={(e) => setCustomAmount(parseFloat(e.target.value) || 0)}
                            className="w-full rounded-lg h-12 bg-transparent border border-lightgrey text-white px-4 text-sm focus:outline-none focus:border-green"
                            placeholder="Enter amount"
                            min="0.01"
                            step="0.01"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-grey mb-1 text-sm">Description</label>
                        <textarea
                            value={customDescription}
                            onChange={(e) => setCustomDescription(e.target.value)}
                            className="w-full rounded-lg bg-transparent border border-lightgrey text-white px-4 py-3 text-sm focus:outline-none focus:border-green resize-none"
                            placeholder="Enter payment description"
                            rows={3}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-grey mb-1 text-sm">Customer Email</label>
                        <input
                            type="email"
                            value={customerEmail}
                            readOnly
                            className="w-full rounded-lg h-12 bg-grey/20 border border-lightgrey text-grey px-4 text-sm cursor-not-allowed"
                            placeholder="Customer email"
                        />
                        <p className="text-xs text-grey mt-1">This email cannot be changed</p>
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
                        className="flex-1 bg-green hover:bg-green/80 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium"
                    >
                        Send Payment Link
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RetryPaymentModal;