import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

const PaymentComplete = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-800 shadow-xl">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#31B099]/10 text-green">
        <CheckCircle className="h-8 w-8" aria-hidden />
      </div>
      <h1 className="mb-2 text-2xl font-bold">Thank you for your payment!</h1>
      <p className="text-slate-600">You will receive a confirmation email and receipt shortly.</p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#234C6A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1b3c53]"
      >
        Go to WisdomLinked
      </Link>
    </div>
  </div>
);

export default PaymentComplete;
