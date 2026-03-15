import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Users, GraduationCap } from 'lucide-react';

export default function WLSignupChoice() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>
      <div className="auth-dots-layer auth-dots-layer--animate" aria-hidden="true" />
      <div className="relative z-10 flex items-center justify-center p-4 sm:p-6 min-h-screen">
        <div className="w-full max-w-lg">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-[#234C6A] text-sm font-semibold mb-6 px-4 py-2 rounded-xl bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm hover:border-[#456882] transition-colors"
          >
            ← Back to Home
          </Link>
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl font-bold text-slate-900 mb-2">Create your account</h1>
            <p className="text-slate-500 text-sm">Choose how you want to join WisdomLinked</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <button
              onClick={() => navigate('/expertregister')}
              className="group p-6 rounded-2xl border-2 border-slate-200 bg-white hover:border-[#456882] hover:shadow-lg transition-all duration-300 text-left"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors"
                style={{ backgroundColor: '#D9EAFD' }}
              >
                <Users size={24} className="text-[#234C6A]" />
              </div>
              <h3 className="font-display font-bold text-slate-800 mb-1 text-lg sm:text-xl">Join as an Expert</h3>
              <p className="text-slate-500 text-xs">Share your expertise and mentor students globally</p>
            </button>
            <button
              onClick={() => navigate('/customerregister')}
              className="group p-6 rounded-2xl border-2 border-slate-200 bg-white hover:border-[#456882] hover:shadow-lg transition-all duration-300 text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mb-4 group-hover:bg-amber-200 transition-colors">
                <GraduationCap size={24} className="text-amber-600" />
              </div>
              <h3 className="font-display font-bold text-slate-800 mb-1 text-lg sm:text-xl">Join as a student</h3>
              <p className="text-slate-500 text-xs">Get guidance on studies, work abroad & research</p>
            </button>
          </div>
          <div className="mt-6 flex flex-col items-center gap-3">
            <p className="text-slate-500 text-sm">
              Already have an account?
            </p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-full border text-sm font-semibold shadow-sm transition-colors"
              style={{
                backgroundColor: '#E8EEF4',
                borderColor: '#234C6A',
                color: '#234C6A'
              }}
            >
              Log in
            </Link>
          </div>
          <Link
            to="/"
            className="mt-4 w-full block text-center py-2.5 rounded-xl border text-sm font-semibold shadow-sm transition-colors"
            style={{
              backgroundColor: '#F1F5F9',
              borderColor: '#CBD5F5',
              color: '#1F2933'
            }}
          >
            Cancel
          </Link>
        </div>
      </div>
      <style>{`
        .font-display { font-family: 'Playfair Display', serif; }
        .auth-dots-layer {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-color: #F8FAFC;
          background-image: radial-gradient(circle, rgba(188,204,220,0.45) 1.8px, transparent 1.8px);
          background-size: 28px 28px;
        }
        .auth-dots-layer--animate {
          animation: authDotsDrift 35s linear infinite;
        }
        @keyframes authDotsDrift {
          0% { background-position: 0 0; }
          100% { background-position: 28px 28px; }
        }
      `}</style>
    </div>
  );
}
