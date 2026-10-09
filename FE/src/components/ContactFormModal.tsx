import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle, FileText, Mail, MessageCircle, Phone, Send, User, X } from 'lucide-react';
import { doContactUs } from '../api/api';
import { notify } from '../utils/notify';
import { PHONE_INVALID_MESSAGE, isPhoneValid, splitPhone } from '../utils/phone';
import PhoneField from './ui/PhoneField';

const CONTACT_MESSAGE_MAX_LENGTH = 100;

export default function ContactFormModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', description: '' });
  const [phoneCountry, setPhoneCountry] = useState('US');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    if (!isPhoneValid(form.phone)) e.phone = PHONE_INVALID_MESSAGE;
    if (!form.subject.trim()) e.subject = 'Subject is required';
    if (!form.description.trim()) e.description = 'Main message is required';
    else if (form.description.trim().length > CONTACT_MESSAGE_MAX_LENGTH) e.description = `Main message must be ${CONTACT_MESSAGE_MAX_LENGTH} characters or less`;
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setSubmitting(true);
    try {
      const { countryCode, national } = splitPhone(form.phone);
      await doContactUs({
        name: form.name,
        email: form.email,
        countryCode,
        contactNumber: national,
        issue: `[${form.subject}] ${form.description}`,
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Contact form error:', err);
      notify.error('Failed to submit. Please try again.');
    }
    setSubmitting(false);
  };

  const inputBase = "w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400";
  const inputNormal = `${inputBase} border-slate-200`;
  const inputError = `${inputBase} border-red-300 focus:ring-red-300 focus:border-red-400 bg-red-50/30`;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,15,35,0.65)', backdropFilter: 'blur(8px)', fontFamily: "'DM Sans', sans-serif" }}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl shadow-2xl"
        style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', animation: 'modalIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        <div className="h-1.5 w-full rounded-t-3xl" style={{ background: 'linear-gradient(90deg, #234C6A, #456882, #234C6A)', backgroundSize: '200%', animation: 'shimmer 3s linear infinite' }} />
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-500 transition-all duration-200 z-10">
          <X size={16} />
        </button>
        <div className="p-7 pb-8">
          {!submitted ? (
            <>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#E8EEF4' }}>
                    <MessageCircle size={16} style={{ color: '#234C6A' }} />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#234C6A' }}>Get In Touch</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-800 leading-tight">Contact Us</h2>
                <p className="text-sm text-slate-500 mt-1">Thank you for reaching out to us. We will look into it seriously and get back soon.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    <span className="flex items-center gap-1.5"><User size={12} /> Full Name</span>
                  </label>
                  <input type="text" placeholder="e.g. Sarah Chen" value={form.name}
                    onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(er => ({ ...er, name: '' })); }}
                    className={errors.name ? inputError : inputNormal} />
                  {errors.name && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.name}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    <span className="flex items-center gap-1.5"><Mail size={12} /> Email Address</span>
                  </label>
                  <input type="email" placeholder="you@example.com" value={form.email}
                    onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setErrors(er => ({ ...er, email: '' })); }}
                    className={errors.email ? inputError : inputNormal} />
                  {errors.email && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.email}</p>}
                </div>
                <div>
                  <label htmlFor="contact-phone" className="block text-xs font-semibold text-slate-600 mb-1.5">
                    <span className="flex items-center gap-1.5"><Phone size={12} /> Contact Number</span>
                  </label>
                  <PhoneField
                    id="contact-phone"
                    name="phone"
                    aria-label="Contact number"
                    className="!bg-white"
                    value={form.phone}
                    onChange={(phone) => { setForm(f => ({ ...f, phone })); setErrors(er => ({ ...er, phone: '' })); }}
                    country={phoneCountry}
                    onCountryChange={setPhoneCountry}
                    invalid={!!errors.phone}
                  />
                  {errors.phone && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.phone}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    <span className="flex items-center gap-1.5"><FileText size={12} /> Subject</span>
                  </label>
                  <input type="text" placeholder="e.g. Graduate school application" value={form.subject}
                    onChange={e => { setForm(f => ({ ...f, subject: e.target.value })); setErrors(er => ({ ...er, subject: '' })); }}
                    className={errors.subject ? inputError : inputNormal} />
                  {errors.subject && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.subject}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    <span className="flex items-center gap-1.5"><FileText size={12} /> Main message</span>
                  </label>
                  <textarea rows={3} placeholder={`Brief message (max ${CONTACT_MESSAGE_MAX_LENGTH} characters)`}
                    value={form.description}
                    maxLength={CONTACT_MESSAGE_MAX_LENGTH}
                    onChange={e => { setForm(f => ({ ...f, description: e.target.value })); setErrors(er => ({ ...er, description: '' })); }}
                    className={`${errors.description ? inputError : inputNormal} resize-none`} style={{ lineHeight: 1.6 }} />
                  <div className="flex items-center justify-between mt-1">
                    {errors.description ? <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.description}</p> : <span />}
                    <span className={`text-xs ml-auto ${form.description.length >= CONTACT_MESSAGE_MAX_LENGTH ? 'text-red-500' : form.description.length > 0 ? 'text-slate-500' : 'text-slate-400'}`}>{form.description.length} / {CONTACT_MESSAGE_MAX_LENGTH}</span>
                  </div>
                </div>
              </div>
              <button onClick={handleSubmit} disabled={submitting}
                className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold text-white shadow-lg transition-all duration-200 disabled:opacity-70"
                style={{ background: submitting ? '#9AA6B2' : 'linear-gradient(135deg, #234C6A 0%, #456882 100%)' }}>
                {submitting ? (
                  <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>Sending...</>
                ) : (<><Send size={15} />Send</>)}
              </button>
              <p className="text-center text-xs text-slate-400 mt-3">We typically respond within 24 hours</p>
            </>
          ) : (
            <div className="py-8 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-5" style={{ animation: 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                <CheckCircle size={40} className="text-emerald-500" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Message Sent!</h3>
              <p className="text-slate-500 text-sm max-w-xs">Thanks, <span className="font-semibold" style={{ color: '#234C6A' }}>{form.name}</span>! We've received your message and will get back to you at <span className="font-medium">{form.email}</span> within 24 hours.</p>
              <button onClick={onClose} className="mt-7 px-8 py-3 rounded-2xl text-sm font-semibold text-white shadow" style={{ background: 'linear-gradient(135deg, #234C6A 0%, #456882 100%)' }}>Close</button>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes modalIn { from { opacity: 0; transform: scale(0.88) translateY(24px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes shimmer { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>,
    document.body,
  );
}
