import React, { useMemo, useState } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { useDispatch } from 'react-redux';

import { doContactUs } from '../../../api/api';
import { useAppSelector } from '../../../store';
import { showErrorAlert, showSuccessAlert, showWarningAlert } from '../../../actions/alertActions';

export default function ContactAdmin() {
  const MAX_CONTACT_MESSAGE_LENGTH = 100;
  const dispatch = useDispatch();
  const {
    auth: { userDetails },
  } = useAppSelector((state) => state);

  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const name = useMemo(
    () =>
      (userDetails?.username as string | undefined) ||
      (userDetails?.name as string | undefined) ||
      'Expert',
    [userDetails?.username, userDetails?.name],
  );

  const email = (userDetails?.email as string | undefined) || '';

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = message.trim();
    if (!body) {
      dispatch(showErrorAlert('Please enter your message before submitting.'));
      return;
    }
    if (body.length > MAX_CONTACT_MESSAGE_LENGTH) {
      dispatch(showErrorAlert(`Please keep the message within ${MAX_CONTACT_MESSAGE_LENGTH} characters.`));
      return;
    }
    if (!email) {
      dispatch(showErrorAlert('Email not found on your profile. Please update profile first.'));
      return;
    }

    setSubmitting(true);
    try {
      const res: any = await doContactUs({
        name,
        email,
        subject: 'Expert contact admin',
        issue: body,
      });
      if (res && res !== false) {
        setMessage('');
        setSubmitted(true);
        dispatch(showSuccessAlert('Your message has been sent to admin.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF] px-5 py-8 md:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-[#e8e6e1] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.06)] md:p-8">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#234C6A]/10 text-[#234C6A]">
              <MessageSquare className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Contact admin</h1>
              <p className="text-sm text-slate-600">
                Share issues, recommendations, or any platform feedback.
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Your message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                placeholder={`Write your issue, recommendation, or message to admin (max ${MAX_CONTACT_MESSAGE_LENGTH} chars)...`}
                maxLength={MAX_CONTACT_MESSAGE_LENGTH}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#234C6A] focus:ring-2 focus:ring-[#234C6A]/20"
              />
              <div className="mt-1 text-right">
                <span className={`text-xs ${message.length >= MAX_CONTACT_MESSAGE_LENGTH ? 'text-red-500' : 'text-slate-500'}`}>
                  {message.length} / {MAX_CONTACT_MESSAGE_LENGTH}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                On submission, admin will respond to you within 1 business day.
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#234C6A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
              >
                <Send className="h-4 w-4" aria-hidden />
                {submitting ? 'Sending...' : 'Submit'}
              </button>
            </div>
          </form>

          {submitted ? (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Message submitted successfully. Admin will respond to you within 1 business
              day.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
