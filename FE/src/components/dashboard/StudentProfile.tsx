import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Mail,
  Lock,
  CreditCard,
  ChevronDown,
  X,
  Check,
  Loader2,
  StickyNote,
  Save,
} from 'lucide-react';
import { useAppSelector } from '../../store';
import { useDispatch } from 'react-redux';
import { showErrorAlert, showSuccessAlert } from '../../actions/alertActions';
import { updateMe } from '../../actions/authActions';
import { doUpdateProfile, profileImageFetch, doGetCustomerPaymentHistory } from '../../api/api';
import { resolveProfileImageSrc } from '../../utils/profileImage';
import { saveProfilePhotoFile } from '../../utils/profileImageUpload';
import { SERVICE_OPTIONS } from '../../constants/serviceOptions';

const PREFERENCE_OPTIONS = SERVICE_OPTIONS.map((o) => ({ id: o.value, label: o.label }));

const INTEREST_OPTIONS = [
  'Civil Engineering',
  'Computer Science',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Chemical Engineering',
  'Aerospace Engineering',
  'Biomedical Engineering',
  'Other Engineering',
  'Other',
];

const inputBase =
  'w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:ring-2 focus:ring-[#234C6A]/30 focus:border-[#234C6A]';
const inputNormal = `${inputBase} border-slate-200`;

type PaymentRecord = {
  _id: string;
  amount: number;
  currency: string;
  description: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  paymentKind: 'individual' | 'seminar' | 'other';
  createdAt: string;
  expert?: { username: string; email: string };
  groupChat?: { name: string; type: string };
  event?: { title: string };
};

export default function StudentProfile() {
  const dispatch = useDispatch();
  const userDetails = useAppSelector((state: any) => state?.auth?.userDetails ?? null);

  const [name, setName] = useState(() => userDetails?.username ?? '');
  const [email, setEmail] = useState(() => userDetails?.email ?? '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const readFileAsDataUrl = (file: File) =>
    new Promise<string | null>(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(typeof reader.result === 'string' ? reader.result : null);
      };
      reader.readAsDataURL(file);
    });
  const [preferences, setPreferences] = useState<Record<string, boolean>>({
    study_abroad: true,
    work_abroad: false,
    research_guidance: true,
  });
  const [interests, setInterests] = useState<string[]>(['Computer Science', 'Other Engineering']);
  const [showInterestDropdown, setShowInterestDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [personalDirty, setPersonalDirty] = useState(false);
  const [personalSaving, setPersonalSaving] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [preferencesDirty, setPreferencesDirty] = useState(false);
  const [interestsDirty, setInterestsDirty] = useState(false);

  const SPECIAL_NOTE_MAX = 2000;
  const [specialNote, setSpecialNote] = useState(() => (userDetails as any)?.specialNote ?? '');
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);

  // Keep profile header fields in sync with the authenticated user.
  // Avoid overwriting while the user is editing the personal section.
  useEffect(() => {
    if (personalDirty) return;
    if (userDetails?.username) setName(userDetails.username);
    if (userDetails?.email) setEmail(userDetails.email);
    let cancelled = false;
    const loadPhoto = async () => {
      const src = await resolveProfileImageSrc(
        userDetails?.image,
        'small',
        profileImageFetch as any,
      );
      if (!cancelled) setPhotoUrl(src);
    };
    void loadPhoto();
    return () => {
      cancelled = true;
    };
  }, [personalDirty, userDetails?.username, userDetails?.email, userDetails?.image]);

  useEffect(() => {
    if (notesDirty) return;
    setSpecialNote((userDetails as any)?.specialNote ?? '');
  }, [notesDirty, (userDetails as any)?.specialNote]);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordStep, setPasswordStep] = useState<'request' | 'verify' | 'done'>('request');
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState('');

  useEffect(() => {
    if (!showPaymentModal) return;
    setPaymentsLoading(true);
    setPaymentsError('');
    doGetCustomerPaymentHistory()
      .then((data: any) => setPayments(data?.result ?? []))
      .catch(() => setPaymentsError('Failed to load payment history.'))
      .finally(() => setPaymentsLoading(false));
  }, [showPaymentModal]);

  const interestDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (interestDropdownRef.current && !interestDropdownRef.current.contains(e.target as Node)) {
        setShowInterestDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const togglePreference = (id: string) => {
    setPreferences(prev => ({ ...prev, [id]: !prev[id] }));
    setPreferencesDirty(true);
  };

  const toggleInterest = (interest: string) => {
    setInterests(prev => {
      const next = prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest];
      return next;
    });
    setInterestsDirty(true);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPhotoUrl(url);
      setPhotoFile(file);
      setPhotoDataUrl(null);

      // Persist image by sending a base64 data URL to the backend.
      // (The backend update endpoint expects `image` in the request body.)
      // Precompute preview payload; we also re-read on save if needed.
      readFileAsDataUrl(file).then(dataUrl => setPhotoDataUrl(dataUrl));
    }
  };

  const hasPhotoChanges = photoFile != null;
  const hasPersonalTextChanges =
    name.trim() !== (userDetails?.username ?? '').trim() ||
    email.trim() !== (userDetails?.email ?? '').trim();

  const profileHasUnsavedChanges =
    hasPersonalTextChanges || preferencesDirty || interestsDirty;

  const handleSavePhoto = async () => {
    if (!photoFile) return;
    setPhotoSaving(true);
    try {
      const filename = await saveProfilePhotoFile(photoFile);
      setPhotoFile(null);
      setPhotoDataUrl(null);
      await dispatch(updateMe() as any);
      const src = await resolveProfileImageSrc(
        filename,
        'small',
        profileImageFetch as any,
      );
      setPhotoUrl(src);
      dispatch(showSuccessAlert('Profile photo saved'));
    } catch (err: any) {
      dispatch(
        showErrorAlert(
          err?.response?.data?.error || err?.message || 'Could not save profile photo',
        ),
      );
    } finally {
      setPhotoSaving(false);
    }
  };

  const handleSavePersonal = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      dispatch(showErrorAlert('Name is required'));
      return;
    }

    setPersonalSaving(true);
    try {
      const ok = await doUpdateProfile({
        username: trimmedName,
      });

      if (ok) {
        setPersonalDirty(false);
        if (userDetails?.email) setEmail(userDetails.email);
        await dispatch(updateMe() as any);
        dispatch(showSuccessAlert('Profile saved'));
      } else {
        dispatch(showErrorAlert('Could not save profile'));
      }
    } catch (err: any) {
      dispatch(showErrorAlert(err?.message || 'Could not save profile'));
    } finally {
      setPersonalSaving(false);
    }
  };

  const handleSaveAllProfileChanges = async () => {
    if (hasPersonalTextChanges) await handleSavePersonal();
    if (preferencesDirty) handleSavePreferences();
    if (interestsDirty) handleSaveInterests();
  };

  const handleSavePreferences = () => {
    // TODO: wire up API call to persist preferences
    setPreferencesDirty(false);
  };

  const handleSaveInterests = () => {
    // TODO: wire up API call to persist interests
    setInterestsDirty(false);
  };

  const handleSaveSpecialNote = async () => {
    const trimmed = specialNote.slice(0, SPECIAL_NOTE_MAX);
    setNotesSaving(true);
    const ok = await doUpdateProfile({ specialNote: trimmed });
    setNotesSaving(false);
    if (ok) {
      setNotesDirty(false);
      setSpecialNote(trimmed);
    }
  };

  const handleRequestOtp = () => {
    setPasswordError('');
    setPasswordLoading(true);
    setTimeout(() => {
      setPasswordLoading(false);
      setOtpSent(true);
      setPasswordStep('verify');
    }, 1200);
  };

  const handleVerifyAndChangePassword = () => {
    setPasswordError('');
    if (otpValue.length < 4) {
      setPasswordError('Please enter the OTP sent to your email.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }
    setPasswordLoading(true);
    setTimeout(() => {
      setPasswordLoading(false);
      setPasswordStep('done');
      setOtpValue('');
      setNewPassword('');
      setConfirmPassword('');
    }, 1000);
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordStep('request');
    setOtpSent(false);
    setOtpValue('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
  };

  const cardClass =
    'rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.06)]';

  return (
    <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF] px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Profile</h1>
      <p className="text-sm text-slate-500 mb-6">
        Manage your account details, preferences, and security.
      </p>

      {/* Profile info: photo, name, email */}
      <section className={cardClass + ' mb-6'}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-900">
            Personal information
          </h2>
          {hasPersonalTextChanges && (
            <button
              type="button"
              onClick={() => void handleSavePersonal()}
              disabled={personalSaving}
              className="rounded-lg bg-[#234C6A] px-3 py-1.5 text-[11px] font-semibold text-white hover:brightness-110 disabled:opacity-50"
            >
              {personalSaving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="flex flex-col items-center sm:items-start">
            <div className="relative">
              <div className="h-24 w-24 rounded-2xl border-2 border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center">
                {photoUrl ? (
                  <img src={photoUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-[#234C6A]">
                    {String(name ?? '')
                      .trim()
                      .split(/\s+/)
                      .filter(Boolean)
                      .map(p => p[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase() || '?'}
                  </span>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Change photo
              </button>
              <button
                type="button"
                disabled={!hasPhotoChanges || photoSaving}
                onClick={() => void handleSavePhoto()}
                className="rounded-lg bg-[#234C6A] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-[#1b3c53] disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {photoSaving ? 'Saving…' : 'Save photo'}
              </button>
            </div>
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                <span className="flex items-center gap-1.5"><User size={12} /> Full name</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => {
                  setName(e.target.value);
                  setPersonalDirty(true);
                }}
                placeholder="Your name"
                className={inputNormal}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                <span className="flex items-center gap-1.5"><Mail size={12} /> Email</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  setPersonalDirty(true);
                }}
                placeholder="you@example.com"
                className={inputNormal}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Preferences & expectations (saved to your account) */}
      <section className={cardClass + ' mb-6'}>
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-[#234C6A]" aria-hidden />
            Preferences &amp; expectations
          </h2>
        </div>
        <p className="text-xs text-slate-600 mb-3">
          Share your goals, learning style, and what you hope to get from mentors or sessions. Mentors you work with can
          use this to prepare.
        </p>
        <textarea
          value={specialNote}
          onChange={e => {
            const v = e.target.value.slice(0, SPECIAL_NOTE_MAX);
            setSpecialNote(v);
            setNotesDirty(true);
          }}
          placeholder="e.g. I’m applying to MS programs in the US, prefer structured feedback, and want help with SOP drafts…"
          rows={5}
          className={`${inputNormal} resize-y min-h-[120px] py-3`}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400">
            {specialNote.length}/{SPECIAL_NOTE_MAX}
          </p>
          <button
            type="button"
            onClick={handleSaveSpecialNote}
            disabled={notesSaving || !notesDirty}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#234C6A] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {notesSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            {notesSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </section>

      {/* Preferences */}
      <section className={cardClass + ' mb-6'}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-900">
            Preferences
          </h2>
          {preferencesDirty && (
            <button
              type="button"
              onClick={handleSavePreferences}
              className="rounded-lg bg-[#234C6A] px-3 py-1.5 text-[11px] font-semibold text-white hover:brightness-110"
            >
              Save
            </button>
          )}
        </div>
        <p className="text-xs text-slate-600 mb-3">
          What are you looking for? (Study Abroad, Work Abroad, Research Guidance, etc.)
        </p>
        <div className="flex flex-wrap gap-3">
          {PREFERENCE_OPTIONS.map(opt => (
            <label
              key={opt.id}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors has-[:checked]:border-[#234C6A] has-[:checked]:bg-[#E8EEF4] has-[:checked]:text-[#234C6A]"
            >
              <input
                type="checkbox"
                checked={!!preferences[opt.id]}
                onChange={() => togglePreference(opt.id)}
                className="rounded border-slate-300 text-[#234C6A] focus:ring-[#234C6A]"
              />
              <span className="text-sm font-medium text-slate-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Interests */}
      <section className={cardClass + ' mb-6'}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-900">
            Interests
          </h2>
          {interestsDirty && (
            <button
              type="button"
              onClick={handleSaveInterests}
              className="rounded-lg bg-[#234C6A] px-3 py-1.5 text-[11px] font-semibold text-white hover:brightness-110"
            >
              Save
            </button>
          )}
        </div>
        <p className="text-xs text-slate-600 mb-3">
          Select your fields of interest (e.g. Civil Engineering, Computer Science, other).
        </p>
        <div className="relative">
          <div className="flex flex-wrap gap-2 mb-3">
            {interests.map(interest => (
              <span
                key={interest}
                className="inline-flex items-center gap-1 rounded-lg bg-[#E8EEF4] text-[#234C6A] px-3 py-1.5 text-xs font-medium"
              >
                {interest}
                <button
                  type="button"
                  onClick={() => toggleInterest(interest)}
                  className="hover:opacity-70"
                  aria-label={`Remove ${interest}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="relative" ref={interestDropdownRef}>
            <button
              type="button"
              onClick={() => setShowInterestDropdown(v => !v)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Add interest
              <ChevronDown className={`h-4 w-4 transition-transform ${showInterestDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showInterestDropdown && (
              <div className="absolute left-0 top-full mt-1 w-64 rounded-xl border border-slate-200 bg-white py-2 shadow-lg z-10 max-h-56 overflow-y-auto">
                {INTEREST_OPTIONS.filter(i => !interests.includes(i)).map(interest => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => {
                      toggleInterest(interest);
                      setShowInterestDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    {interest}
                  </button>
                ))}
                {INTEREST_OPTIONS.every(i => interests.includes(i)) && (
                  <p className="px-4 py-2 text-xs text-slate-500">All interests selected.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Actions: Change password, Payment history */}
      <section className={cardClass}>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-900 mb-4">
          Security & billing
        </h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setShowPasswordModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-[#234C6A] hover:text-[#234C6A] transition-colors"
          >
            <Lock className="h-4 w-4" />
            Change password
          </button>
          <button
            type="button"
            onClick={() => setShowPaymentModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-[#234C6A] hover:text-[#234C6A] transition-colors"
          >
            <CreditCard className="h-4 w-4" />
            Payment history
          </button>
        </div>
      </section>

      {/* Change password modal (OTP) */}
      {showPasswordModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40"
          onClick={e => e.target === e.currentTarget && closePasswordModal()}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Change password</h3>
              <button
                type="button"
                onClick={closePasswordModal}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {passwordStep === 'request' && (
                <>
                  <p className="text-sm text-slate-600">
                    We&apos;ll send a one-time code to <strong>{email}</strong> to verify it&apos;s you.
                  </p>
                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={passwordLoading}
                    className="w-full rounded-xl bg-[#234C6A] text-white py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {passwordLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Send OTP to email'
                    )}
                  </button>
                </>
              )}
              {passwordStep === 'verify' && (
                <>
                  <p className="text-sm text-slate-600">
                    Enter the 6-digit code sent to your email.
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpValue}
                    onChange={e => setOtpValue(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className={inputNormal + ' text-center text-lg tracking-widest'}
                  />
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      New password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className={inputNormal}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Confirm password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className={inputNormal}
                    />
                  </div>
                  {passwordError && (
                    <p className="text-xs text-red-600 flex items-center gap-1">{passwordError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPasswordStep('request')}
                      className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleVerifyAndChangePassword}
                      disabled={passwordLoading}
                      className="flex-1 rounded-xl bg-[#234C6A] text-white py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                      {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
                    </button>
                  </div>
                </>
              )}
              {passwordStep === 'done' && (
                <div className="text-center py-4">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3">
                    <Check className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium text-slate-800">Password updated successfully.</p>
                  <p className="text-xs text-slate-500 mt-1">You can close this window.</p>
                  <button
                    type="button"
                    onClick={closePasswordModal}
                    className="mt-4 rounded-xl bg-[#234C6A] text-white px-4 py-2 text-sm font-semibold"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment history modal */}
      {showPaymentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40"
          onClick={e => e.target === e.currentTarget && setShowPaymentModal(false)}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 shrink-0">
              <h3 className="text-lg font-semibold text-slate-900">Payment history</h3>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Date
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Session / Seminar
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Type / Expert
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paymentsLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                        Loading payment history…
                      </td>
                    </tr>
                  ) : paymentsError ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-red-500">
                        {paymentsError}
                      </td>
                    </tr>
                  ) : payments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                        No payment history yet.
                      </td>
                    </tr>
                  ) : (
                    payments.map(p => {
                      const sessionLabel = p.groupChat?.name ?? p.event?.title ?? p.description ?? '—';
                      const kindLabel = p.paymentKind === 'seminar' ? 'Seminar' : p.paymentKind === 'individual' ? 'Session' : 'Other';
                      const amountDollars = (p.amount / 100).toFixed(2);
                      return (
                        <tr key={p._id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {new Date(p.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-800">
                            {(p.currency ?? 'usd').toUpperCase()} {amountDollars}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">{sessionLabel}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            <span className="text-slate-500">{kindLabel}</span>
                            {p.expert && (
                              <span className="block text-slate-700">{p.expert.username}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                p.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : p.status === 'pending'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-200 px-6 py-3 bg-slate-50 text-sm text-slate-600 shrink-0">
              {paymentsLoading ? 'Loading…' : (
                <>
                  Total payments: {payments.length} · Total spent: USD{' '}
                  {(payments.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0) / 100).toFixed(2)}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {profileHasUnsavedChanges ? (
        <div className="sticky bottom-4 z-10 mt-6">
          <div className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-md px-5 py-3.5 shadow-lg flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">You have unsaved profile changes.</p>
            <button
              type="button"
              onClick={() => void handleSaveAllProfileChanges()}
              disabled={personalSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#234C6A] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1b3c53] disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {personalSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Save className="h-4 w-4" aria-hidden />
              )}
              Save changes
            </button>
          </div>
        </div>
      ) : null}

      </div>
    </div>
  );
}
