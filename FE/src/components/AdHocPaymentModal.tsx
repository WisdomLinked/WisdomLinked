import React, { useState } from "react";
import CloseIcon from '@mui/icons-material/Close';

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

const AdHocPaymentModal: React.FC<AdHocPaymentModalProps> = ({
    isOpen,
    onClose,
    onConfirm
}) => {
    const [amount, setAmount] = useState<number>(0);
    const [description, setDescription] = useState<string>('');
    const [customerEmail, setCustomerEmail] = useState<string>('');
    const [customerName, setCustomerName] = useState<string>('');

    const handleConfirm = () => {
        // Validation
        if (!amount || amount <= 0) {
            alert('Please enter a valid amount greater than $0');
            return;
        }
        
        if (!description.trim()) {
            alert('Please enter a payment description');
            return;
        }

        if (!customerEmail.trim()) {
            alert('Please enter customer email address');
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customerEmail.trim())) {
            alert('Please enter a valid email address');
            return;
        }

        onConfirm({
            amount,
            description: description.trim(),
            customerEmail: customerEmail.trim(),
            customerName: customerName.trim() || undefined
        });
    };

    const handleClose = () => {
        // Reset form
        setAmount(0);
        setDescription('');
        setCustomerEmail('');
        setCustomerName('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div 
                className="absolute top-0 left-0 w-full h-full cursor-pointer"
                onClick={handleClose}
            />
            <div className="relative bg-black border border-lightgrey rounded-lg w-full max-w-md p-6 text-white">
                <button 
                    className="absolute right-2 top-2 rounded-md hover:bg-grey p-1"
                    onClick={handleClose}
                >
                    <CloseIcon fontSize="small" />
                </button>
                
                <h2 className="text-xl font-semibold mb-6 text-center">Send Ad-hoc Payment Request</h2>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-grey mb-1 text-sm">Amount ($)*</label>
                        <input
                            type="number"
                            value={amount || ''}
                            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                            className="w-full rounded-lg h-12 bg-transparent border border-lightgrey text-white px-4 text-sm focus:outline-none focus:border-blue-500"
                            placeholder="Enter payment amount"
                            min="0.01"
                            step="0.01"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-grey mb-1 text-sm">Payment Description*</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full rounded-lg bg-transparent border border-lightgrey text-white px-4 py-3 text-sm focus:outline-none focus:border-blue-500 resize-none"
                            placeholder="Describe what this payment is for..."
                            rows={3}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-grey mb-1 text-sm">Customer Email*</label>
                        <input
                            type="email"
                            value={customerEmail}
                            onChange={(e) => setCustomerEmail(e.target.value)}
                            className="w-full rounded-lg h-12 bg-transparent border border-lightgrey text-white px-4 text-sm focus:outline-none focus:border-blue-500"
                            placeholder="customer@example.com"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-grey mb-1 text-sm">Customer Name (Optional)</label>
                        <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="w-full rounded-lg h-12 bg-transparent border border-lightgrey text-white px-4 text-sm focus:outline-none focus:border-blue-500"
                            placeholder="Customer's full name"
                        />
                        <p className="text-xs text-grey mt-1">This will be used for record keeping</p>
                    </div>
                </div>
                
                <div className="mt-6 p-4 bg-grey/10 rounded-lg border border-grey/20">
                    <h3 className="text-sm font-medium mb-2">What happens next?</h3>
                    <ul className="text-xs text-grey space-y-1">
                        <li>• Payment link will be sent to the customer's email</li>
                        <li>• Customer will receive payment confirmation upon completion</li>
                    </ul>
                </div>
                
                <div className="flex gap-3 mt-6">
                    <button
                        onClick={handleClose}
                        className="flex-1 bg-transparent border border-lightgrey text-white py-2 px-4 rounded-lg hover:bg-grey/20 transition-colors text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium"
                    >
                        Send Payment Link
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdHocPaymentModal;