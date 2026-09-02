import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

export default function LoginSuccessPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const id = setTimeout(() => {
      navigate('/dashboard');
    }, 2000);
    return () => clearTimeout(id);
  }, [navigate]);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#F8FAFC' }}
    >
      <div className="text-center px-6">
        <div className="mb-6 inline-flex items-center justify-center">
          <span className="relative inline-flex">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-60 animate-ping" />
            <span className="relative inline-flex rounded-full bg-emerald-100 p-4">
              <CheckCircle2 className="h-12 w-12 text-emerald-600 animate-bounce" aria-hidden="true" />
            </span>
          </span>
        </div>
        <h1 className="font-display text-3xl font-bold text-slate-900 mb-2">
          You're in!
        </h1>
        <p className="text-slate-500 text-sm">
          Taking you to your dashboard...
        </p>
      </div>
    </div>
  );
}

