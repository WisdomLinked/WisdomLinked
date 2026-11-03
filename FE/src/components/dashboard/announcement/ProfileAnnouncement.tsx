import React, { useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Flag,
  Megaphone,
} from 'lucide-react';
import AccessibleDialog from '../../ui/AccessibleDialog';
import { reportExpertAnnouncement } from '../../../api/api';
import useNow from '../../../hooks/useNow';
import {
  DETAILS_MAX,
  displayLinkHost,
  firstNameFromDisplayName,
  formatEndDate,
  formatPostedAgo,
  formatShortDate,
  isEndingSoon,
  isVisibleToStudents,
  typeLabel,
  type Announcement,
} from '../../../utils/expertAnnouncement';

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam or misleading' },
  { value: 'not_real', label: "Doesn't look like a real opportunity" },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'other', label: 'Something else' },
] as const;

type ProfileAnnouncementProps = {
  announcement: Announcement | null | undefined;
  expertName: string;
  isOwnProfile?: boolean;
  onMessage: () => void;
  onBookSession: () => void;
  children: (slots: {
    pill: React.ReactNode;
    strip: React.ReactNode;
  }) => React.ReactNode;
};

export default function ProfileAnnouncement({
  announcement,
  expertName,
  isOwnProfile = false,
  onMessage,
  onBookSession,
  children,
}: ProfileAnnouncementProps) {
  const now = useNow();
  const visible = isVisibleToStudents(announcement, now);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'details' | 'report' | 'thanks'>('details');
  const [reason, setReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible && open) setOpen(false);
  }, [visible, open]);

  if (!visible || !announcement) {
    return <>{children({ pill: null, strip: null })}</>;
  }

  const endingSoon = isEndingSoon(announcement, now);
  const firstName = firstNameFromDisplayName(expertName);

  const openDetails = () => {
    setView('details');
    setReason('');
    setDetails('');
    setReasonError(null);
    setReportError(null);
    setOpen(true);
  };

  const closeDialog = () => {
    if (sending) return;
    setOpen(false);
    setView('details');
    setReason('');
    setDetails('');
    setReasonError(null);
    setReportError(null);
  };

  const sendReport = async () => {
    if (!reason) {
      setReasonError('Choose a reason.');
      return;
    }
    setReasonError(null);
    setReportError(null);
    setSending(true);
    try {
      const res = await reportExpertAnnouncement(announcement.id, {
        reason,
        details: details.trim() || undefined,
      });
      if (res?.status === 'SUCCESS') {
        setView('thanks');
        return;
      }
      setReportError("We couldn't send your report. Try again.");
    } catch {
      setReportError("We couldn't send your report. Try again.");
    } finally {
      setSending(false);
    }
  };

  const pill = (
    <button
      type="button"
      onClick={openDetails}
      aria-haspopup="dialog"
      aria-label={`New announcement: ${announcement.title}`}
      className="inline-flex min-h-[28px] items-center gap-1.5 rounded-full bg-[#E07B54] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E07B54]/50"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
      New
    </button>
  );

  const strip = (
    <button
      type="button"
      onClick={openDetails}
      aria-haspopup="dialog"
      className="flex w-full min-h-[44px] items-center gap-3 rounded-xl border border-[#E07B54]/25 bg-[#E07B54]/10 px-3 py-3 text-left hover:bg-[#E07B54]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E07B54]/40"
    >
      <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#E07B54] sm:flex">
        <Megaphone className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-[#E07B54]">
          {typeLabel(announcement.type)} ·{' '}
          {endingSoon ? 'Closing soon' : `Open until ${formatShortDate(announcement.endsAt)}`}
        </p>
        <p className="mt-0.5 truncate text-sm font-medium text-[#1A3A4A]">{announcement.title}</p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[#1A3A4A]">
        <span className="hidden sm:inline">View details</span>
        <ChevronRight className="h-4 w-4" aria-hidden />
      </span>
    </button>
  );

  const dialogTitle =
    view === 'details'
      ? `ANNOUNCEMENT FROM ${expertName.toUpperCase()}`
      : view === 'report'
        ? "What's wrong with this post?"
        : 'Thanks for letting us know';

  return (
    <>
      {children({ pill, strip })}
      <AccessibleDialog
        open={open}
        onClose={closeDialog}
        title={dialogTitle}
        sheetOnMobile
        busy={sending}
        className="sm:max-w-lg"
        footer={
          view === 'details' ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    closeDialog();
                    onMessage();
                  }}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-wl-brand px-4 py-2.5 text-sm font-semibold text-white hover:brightness-95"
                >
                  Message {firstName}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeDialog();
                    onBookSession();
                  }}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-wl-line bg-white px-4 py-2.5 text-sm font-semibold text-wl-ink hover:bg-wl-pageAlt"
                >
                  Book a session
                </button>
              </div>
              {!isOwnProfile ? (
                <button
                  type="button"
                  onClick={() => setView('report')}
                  className="inline-flex w-full items-center justify-center gap-1.5 text-xs text-wl-muted hover:text-wl-ink"
                >
                  <Flag className="h-3.5 w-3.5" aria-hidden />
                  Report this post
                </button>
              ) : null}
            </div>
          ) : view === 'report' ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={sending}
                onClick={() => setView('details')}
                className="min-h-[44px] rounded-lg border border-wl-line bg-white px-4 py-2.5 text-sm font-semibold text-wl-ink disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={() => void sendReport()}
                className="min-h-[44px] rounded-lg bg-red px-4 py-2.5 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
              >
                {sending ? 'Sending…' : 'Send report'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={closeDialog}
              className="min-h-[44px] w-full rounded-lg bg-wl-brand px-4 py-2.5 text-sm font-semibold text-white hover:brightness-95 sm:w-auto"
            >
              Close
            </button>
          )
        }
      >
        {view === 'details' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                {typeLabel(announcement.type)}
              </span>
              {endingSoon ? (
                <span className="inline-flex rounded-full bg-[#E07B54]/15 px-2.5 py-1 text-[11px] font-semibold text-[#E07B54]">
                  Closing soon
                </span>
              ) : null}
            </div>
            <h3 className="font-serif text-2xl font-medium text-wl-ink">{announcement.title}</h3>
            <p className="text-sm text-wl-muted">{formatPostedAgo(announcement.publishedAt, now)}</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-wl-ink">{announcement.message}</p>
            <div className="space-y-2 border-t border-wl-line pt-4 text-sm text-wl-muted">
              <p className="inline-flex items-center gap-2">
                <Calendar className="h-4 w-4" aria-hidden />
                Open until {formatEndDate(announcement.endsAt)}
              </p>
              {announcement.link ? (
                <a
                  href={announcement.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-medium text-wl-brand hover:underline"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  {displayLinkHost(announcement.link)}
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

        {view === 'report' ? (
          <div className="space-y-4">
            <p className="text-sm text-wl-muted">
              Our team reviews every report. {firstName} won&apos;t see who sent it.
            </p>
            <div className="space-y-2" role="radiogroup" aria-label="Report reason">
              {REPORT_REASONS.map(opt => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-center rounded-xl border px-4 py-3 text-sm ${
                    reason === opt.value
                      ? 'border-wl-brand bg-wl-brandSoft/60'
                      : 'border-wl-line bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="ann-report-reason"
                    className="sr-only"
                    checked={reason === opt.value}
                    onChange={() => {
                      setReason(opt.value);
                      setReasonError(null);
                    }}
                  />
                  <span className="font-medium text-wl-ink">{opt.label}</span>
                </label>
              ))}
            </div>
            {reasonError ? <p className="text-sm text-red-700">{reasonError}</p> : null}
            <div>
              <label htmlFor="ann-report-details" className="mb-1 block text-sm font-medium text-wl-ink">
                Anything else?
              </label>
              <textarea
                id="ann-report-details"
                rows={3}
                maxLength={DETAILS_MAX}
                value={details}
                onChange={e => setDetails(e.target.value)}
                className="w-full rounded-lg border border-wl-line px-3 py-2 text-sm outline-none focus:border-wl-brand focus:ring-2 focus:ring-wl-brand/40"
              />
            </div>
            {reportError ? <p className="text-sm text-red-700">{reportError}</p> : null}
          </div>
        ) : null}

        {view === 'thanks' ? (
          <div className="space-y-3 py-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden />
            <p className="font-medium text-wl-ink">Thanks for letting us know</p>
            <p className="text-sm text-wl-muted">
              We&apos;ll review this post and take it down if it breaks our guidelines.
            </p>
          </div>
        ) : null}
      </AccessibleDialog>
    </>
  );
}
