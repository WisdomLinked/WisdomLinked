import { useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { confirmPasswordResetByCode, passwordResetRequest } from '../../api/api';
import FormAlert from '../FormAlert';
import { useFormAlert } from '../../hooks/useFormAlert';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:ring-2 focus:ring-[#234C6A]/30 focus:border-[#234C6A]';

type Props = {
  email: string;
  onClose: () => void;
};

export default function ChangePasswordModal({ email, onClose }: Props) {
  const [step, setStep] = useState<'request' | 'verify' | 'done'>('request');
  const [otpValue, setOtpValue] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { message: alert, variant: alertVariant, setFormError: setError, clearFormAlert: clearAlert } = useFormAlert();

  const handleRequestOtp = async () => {
    clearAlert();
    setLoading(true);
    try {
      const res = (await passwordResetRequest({ email })) as any;
      if (res === false) return; // session expired -> handled (logged out) upstream
      if (res?.status === 'SUCCESS') {
        setStep('verify');
      } else {
        setError(res?.error || 'Could not send the code. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'Could not send the code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndChangePassword = async () => {
    clearAlert();
    if (otpValue.length < 6) {
      setError('Please enter the 6-digit code sent to your email.');
      return;
    }
    if (
      newPassword.length < 8 ||
      !/[A-Z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword) ||
      !/[^A-Za-z0-9]/.test(newPassword)
    ) {
      setError('Password must be 8+ characters and include an uppercase letter, a number, and a symbol.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = (await confirmPasswordResetByCode({
        email,
        password: newPassword,
        code: otpValue,
      })) as any;
      if (res === false) return; // session expired -> handled (logged out) upstream
      if (res?.status === 'SUCCESS') {
        setStep('done');
        setOtpValue('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(res?.error || 'Could not update your password. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'Could not update your password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 id="change-password-title" className="text-lg font-semibold text-slate-900">
            Change password
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {step !== 'done' && alert && (
            <FormAlert variant={alertVariant} message={alert} onDismiss={clearAlert} />
          )}
          {step === 'request' && (
            <>
              <p className="text-sm text-slate-600">
                We&apos;ll send a one-time code to <strong>{email}</strong> to verify it&apos;s you.
              </p>
              <button
                type="button"
                onClick={handleRequestOtp}
                disabled={loading}
                className="w-full rounded-xl bg-[#234C6A] text-white py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send OTP to email'}
              </button>
            </>
          )}
          {step === 'verify' && (
            <>
              <p className="text-sm text-slate-600">Enter the 6-digit code sent to your email.</p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpValue}
                onChange={e => setOtpValue(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                aria-label="One-time code"
                className={inputClass + ' text-center text-lg tracking-widest'}
              />
              <div>
                <label htmlFor="change-password-new" className="block text-xs font-semibold text-slate-600 mb-1">
                  New password
                </label>
                <input
                  id="change-password-new"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="change-password-confirm" className="block text-xs font-semibold text-slate-600 mb-1">
                  Confirm password
                </label>
                <input
                  id="change-password-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className={inputClass}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('request')}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleVerifyAndChangePassword}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-[#234C6A] text-white py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
                </button>
              </div>
            </>
          )}
          {step === 'done' && (
            <div className="text-center py-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3">
                <Check className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-slate-800">Password updated successfully.</p>
              <p className="text-xs text-slate-500 mt-1">You can close this window.</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 rounded-xl bg-[#234C6A] text-white px-4 py-2 text-sm font-semibold"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
