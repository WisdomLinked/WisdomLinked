import React from 'react';
import { Clock, Mail, Phone } from 'lucide-react';
import ContactStatusBadge, { type ContactStatus } from './ContactStatusBadge';

export type ContactedUsItem = {
  _id: string;
  name: string;
  email: string;
  countryCode?: string;
  contactNumber?: string;
  issue?: string;
  actioned: string;
  createdAt: string;
};

const caption = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-wl-muted';

function firstName(name?: string): string {
  const token = String(name || '').trim().split(/\s+/)[0];
  return token || 'them';
}

function phoneLabel(item: ContactedUsItem): { text: string; missing: boolean } {
  const value = `${item.countryCode || ''} ${item.contactNumber || ''}`.trim();
  return value ? { text: value, missing: false } : { text: 'Not provided', missing: true };
}

function ReplyFields({
  id,
  name,
  message,
  error,
  sending,
  onMessageChange,
  onSendEmail,
}: {
  id: string;
  name: string;
  message: string;
  error?: string;
  sending?: boolean;
  onMessageChange: (value: string) => void;
  onSendEmail: () => void;
}) {
  const replyTo = firstName(name);
  return (
    <div>
      <label htmlFor={`contact-reply-${id}`} className={caption}>
        Reply
      </label>
      <textarea
        id={`contact-reply-${id}`}
        className="block w-full rounded-lg border border-wl-line bg-wl-card p-2 text-sm text-wl-ink outline-none placeholder:text-wl-muted focus:ring-2 focus:ring-green/40"
        rows={3}
        value={message}
        placeholder={`Write a reply to ${replyTo}`}
        onChange={e => onMessageChange(e.target.value)}
      />
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <div className="mt-3 flex justify-center">
        <button
          type="button"
          disabled={sending}
          onClick={onSendEmail}
          className="rounded-lg bg-wl-brand px-8 py-2.5 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send Email'}
        </button>
      </div>
    </div>
  );
}

export default function ContactRequestCard({
  item,
  message,
  error,
  sending,
  onMessageChange,
  onSendEmail,
}: {
  item: ContactedUsItem;
  message: string;
  error?: string;
  sending?: boolean;
  onMessageChange: (value: string) => void;
  onSendEmail: () => void;
}) {
  const pending = item.actioned !== 'Yes';
  const status: ContactStatus = pending ? 'pending' : 'responded';
  const phone = phoneLabel(item);

  return (
    <article
      className={`rounded-2xl border border-wl-line p-4 shadow-sm ${
        pending ? 'border-l-4 border-l-wl-brand bg-wl-card' : 'bg-wl-pageAlt/60'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <span className={caption}>From</span>
          <h3 className="text-lg font-semibold text-wl-ink">{item.name}</h3>
        </div>
        <ContactStatusBadge status={status} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="min-w-0">
          <span className={caption}>Email</span>
          <span className="inline-flex min-w-0 items-center gap-1.5 text-sm text-wl-ink">
            <Mail className="h-3.5 w-3.5 shrink-0 text-wl-muted" aria-hidden />
            <span className="truncate">{item.email}</span>
          </span>
        </div>
        <div>
          <span className={caption}>Phone</span>
          <span className="inline-flex items-center gap-1.5 text-sm">
            <Phone className="h-3.5 w-3.5 shrink-0 text-wl-muted" aria-hidden />
            <span className={phone.missing ? 'text-wl-muted' : 'text-wl-ink'}>{phone.text}</span>
          </span>
        </div>
        <div>
          <span className={caption}>Received</span>
          <span className="inline-flex items-center gap-1.5 text-sm text-wl-ink">
            <Clock className="h-3.5 w-3.5 shrink-0 text-wl-muted" aria-hidden />
            {new Date(item.createdAt).toLocaleString()}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <span className={caption}>Message</span>
        <p className="whitespace-pre-wrap text-base leading-relaxed text-wl-ink">
          {item.issue || '—'}
        </p>
      </div>

      <div className="mt-4">
        {pending ? (
          <ReplyFields
            id={item._id}
            name={item.name}
            message={message}
            error={error}
            sending={sending}
            onMessageChange={onMessageChange}
            onSendEmail={onSendEmail}
          />
        ) : (
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-wl-brand hover:underline">
              View/Edit reply
            </summary>
            <div className="mt-3">
              <ReplyFields
                id={item._id}
                name={item.name}
                message={message}
                error={error}
                sending={sending}
                onMessageChange={onMessageChange}
                onSendEmail={onSendEmail}
              />
            </div>
          </details>
        )}
      </div>
    </article>
  );
}
