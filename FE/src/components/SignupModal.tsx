import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Users, GraduationCap } from 'lucide-react';

export default function SignupModal({ onClose, onGoLogin }: { onClose: () => void; onGoLogin: () => void }) {
  const navigate = useNavigate();

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,15,35,0.65)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-white rounded-3xl p-8 shadow-2xl relative" style={{ animation: 'modalIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}>
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all z-10">
          <X size={16} />
        </button>
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-slate-900 mb-2">Create your account</h1>
          <p className="text-slate-500 text-sm">Choose how you want to join WisdomLinked</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <button
            onClick={() => { onClose(); navigate('/expertregister'); }}
            className="group p-6 rounded-2xl border-2 border-slate-200 bg-white hover:border-[#456882] hover:shadow-lg transition-all duration-300 text-left"
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors" style={{ backgroundColor: '#D9EAFD' }}>
              <Users size={24} className="text-[#234C6A]" />
            </div>
            <h3 className="font-display font-bold text-slate-800 mb-1">Join as an expert</h3>
            <p className="text-slate-500 text-xs">Share your expertise and mentor students globally</p>
          </button>
          <button
            onClick={() => { onClose(); navigate('/customerregister'); }}
            className="group p-6 rounded-2xl border-2 border-slate-200 bg-white hover:border-[#456882] hover:shadow-lg transition-all duration-300 text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mb-4 group-hover:bg-amber-200 transition-colors">
              <GraduationCap size={24} className="text-amber-600" />
            </div>
            <h3 className="font-display font-bold text-slate-800 mb-1">Join as a student</h3>
            <p className="text-slate-500 text-xs">Get guidance on studies, work abroad & research</p>
          </button>
        </div>
        <p className="text-center text-slate-500 text-sm mt-6">
          Already have an account? <button type="button" onClick={onGoLogin} className="font-semibold text-[#234C6A] hover:underline">Log in</button>
        </p>
      </div>
    </div>
  );
}
