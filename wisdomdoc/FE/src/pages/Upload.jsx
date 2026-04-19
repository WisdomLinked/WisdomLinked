import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../config';
import { formatDate } from '../utils/dateFormat';
import styles from './Upload.module.css';

const DOC_TYPES = [
  { id: 'sop', label: 'Statement of Purpose(SOP)' },
  { id: 'lor', label: 'Letter of recommendation(LOR)' },
  { id: 'resume', label: 'Resume' },
  { id: 'transcript', label: 'Transcript' },
  { id: 'additional', label: 'Additional files' },
];

/** Fixed required slots for submission (same as server validation) */
const REQUIRED_SUBMISSION_SLOTS = [
  { id: 'sop', label: 'Statement of Purpose(SOP)' },
  { id: 'lor', label: 'Letter of recommendation(LOR)' },
  { id: 'resume', label: 'Resume' },
  { id: 'transcript', label: 'Transcript' },
];

const EXPECTED_REVIEW_BUSINESS_DAYS = 10;

/**
 * Wang: complete student-facing status set — maps internal workflow to these phrases only.
 */
function studentCaseHeadline(status) {
  if (!status) return '';
  switch (status) {
    case 'submitted':
      return 'Awaiting Expert Assignment';
    case 'assigned':
      return 'Expert Assigned';
    case 'pending_admin_approval':
      return 'Expert Approved';
    case 'under_review':
    case 'resubmitted':
    case 'overdue':
      return 'Your materials are under review';
    case 'needs_info':
      return 'Action needed: Expert requested additional documents';
    case 'approved':
      return 'Decision: Approved';
    case 'rejected':
      return 'Decision: Rejected';
    case 'withdrawn':
      return 'Withdrawn';
    default:
      return '';
  }
}

/** Optional second line for states that need extra clarity */
function studentCaseSubline(status) {
  switch (status) {
    case 'assigned':
      return 'An expert is assigned - they have not started reviewing your materials yet.';
    case 'pending_admin_approval':
      return 'Expert has recommended a decision, final admission approval is pending.';
    case 'overdue':
      return 'This case is past the committee due date; the committee has been notified.';
    default:
      return '';
  }
}

function studentTimelineHint(status) {
  switch (status) {
    case 'submitted':
      return `Once an Expert begins reviewing, expect a decision within about ${EXPECTED_REVIEW_BUSINESS_DAYS} business days in most cases.`;
    case 'assigned':
      return `After review begins, most files are completed within ${EXPECTED_REVIEW_BUSINESS_DAYS} business days.`;
    case 'under_review':
    case 'resubmitted':
      return `Expected review within ${EXPECTED_REVIEW_BUSINESS_DAYS} business days (typical).`;
    case 'pending_admin_approval':
      return 'You will be notified when final admission approval is complete.';
    case 'overdue':
      return `Expected review within ${EXPECTED_REVIEW_BUSINESS_DAYS} business days (typical), subject to committee scheduling.`;
    default:
      return '';
  }
}

function countRequiredDocsUploaded(documents) {
  const studentDocs = documents.filter((d) => !d.uploaded_by);
  const uploaded = REQUIRED_SUBMISSION_SLOTS.filter((slot) =>
    studentDocs.some((d) => d.type === slot.id)
  ).length;
  return { uploaded, total: REQUIRED_SUBMISSION_SLOTS.length };
}

/** Which step is highlighted on the progress track (0–4) */
function studentProgressStepIndex(status) {
  if (!status) return 0;
  if (status === 'submitted' || status === 'assigned') return 0;
  if (
    status === 'under_review' ||
    status === 'resubmitted' ||
    status === 'pending_admin_approval' ||
    status === 'overdue'
  )
    return 1;
  if (status === 'needs_info') return 2;
  if (status === 'approved' || status === 'rejected') return 3;
  if (status === 'withdrawn') return 4;
  return 0;
}

const PROGRESS_STEPS = [
  { key: 'queue', label: 'Awaiting Expert Assignment' },
  { key: 'review', label: 'Under review' },
  { key: 'action', label: 'Action needed' },
  { key: 'decision', label: 'Decision' },
  { key: 'withdrawn', label: 'Withdrawn' },
];

const WITHDRAWABLE_STATUSES = [
  'submitted',
  'assigned',
  'under_review',
  'needs_info',
  'resubmitted',
  'overdue',
  'pending_admin_approval',
];

export default function Upload() {
  const { token } = useAuth();
  const [previewDoc, setPreviewDoc] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [clarifications, setClarifications] = useState([]);
  const [isApproved, setIsApproved] = useState(false);
  const [timezone, setTimezone] = useState('America/Chicago');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null);
  const [messageSaving, setMessageSaving] = useState(false);
  const [error, setError] = useState('');
  const [additionalFile, setAdditionalFile] = useState(null);
  const [additionalDesc, setAdditionalDesc] = useState('');
  const [myCases, setMyCases] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [canUploadDocuments, setCanUploadDocuments] = useState(true);
  const [uploadDisabledReason, setUploadDisabledReason] = useState(null);
  const [additionalInputKey, setAdditionalInputKey] = useState(0);

  const headers = () => ({ Authorization: `Bearer ${token}` });

  /** e.g. "Cover Letter.pdf" → "Cover Letter (1).pdf", bumping until not in list */
  function uniqueCopyFilename(originalName, existingFilenames) {
    const existing = new Set(existingFilenames.map((f) => f));
    const dot = originalName.lastIndexOf('.');
    const base = dot >= 0 ? originalName.slice(0, dot) : originalName;
    const ext = dot >= 0 ? originalName.slice(dot) : '';
    let n = 1;
    let candidate = `${base} (${n})${ext}`;
    while (existing.has(candidate)) {
      n += 1;
      candidate = `${base} (${n})${ext}`;
    }
    return candidate;
  }

  const downloadUrl = (docId) =>
    `${API}/documents/${docId}/download?token=${encodeURIComponent(token)}`;
  const previewUrl = (docId) =>
    `${API}/documents/${docId}/preview?token=${encodeURIComponent(token)}`;

  const requiredTypes = ['sop', 'lor', 'resume', 'transcript'];
  const hasRequiredDocs = requiredTypes.every(
    (t) => documents.some((d) => d.type === t && !d.uploaded_by)
  );
  const TERMINAL = ['approved', 'rejected', 'withdrawn'];
  const activeCase = myCases.find((c) => !TERMINAL.includes(c.status));
  const hasFinalApprovedCase = myCases.some((c) => c.status === 'approved');
  /** Preparing documents before a workflow case exists (not while a prior case is closed and uploads are blocked) */
  const showInProgressBanner = isApproved && !activeCase && !hasFinalApprovedCase && canUploadDocuments;
  /** Server-driven; falls back if older API */
  const uploadsLocked = !canUploadDocuments;

  function ingestDocumentsPayload(docsData, cases) {
    setDocuments(docsData.documents || []);
    const approved = !!docsData.isApproved;
    setIsApproved(approved);
    setMessages(docsData.messages || []);
    setClarifications(docsData.clarifications || []);
    setTimezone(docsData.timezone || 'America/Chicago');
    setMyCases(cases);
    const hasApprovedCase = cases.some((c) => c.status === 'approved');
    const act = cases.find((c) => !TERMINAL.includes(c.status));
    const hasClosedOnly =
      !act && cases.some((c) => c.status === 'rejected' || c.status === 'withdrawn');
    const fallbackCan =
      approved && !hasApprovedCase && !hasClosedOnly && (act ? act.status === 'needs_info' : true);
    if (docsData.canUploadDocuments !== undefined) {
      setCanUploadDocuments(!!docsData.canUploadDocuments);
    } else {
      setCanUploadDocuments(fallbackCan);
    }
    setUploadDisabledReason(docsData.uploadDisabledReason || null);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [docsRes, casesRes] = await Promise.all([
          fetch(`${API}/documents`, { headers: headers() }),
          fetch(`${API}/cases`, { headers: headers() }),
        ]);
        const docsData = await docsRes.json();
        const casesData = casesRes.ok ? await casesRes.json() : { cases: [] };
        if (!cancelled) {
          ingestDocumentsPayload(docsData, casesData.cases || []);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load documents');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function handleUpload(type, file, description) {
    if (!file || uploadsLocked) return;
    let displayName = file.name;
    if (type === 'additional') {
      const existingNames = documents
        .filter((d) => d.type === 'additional' && !d.uploaded_by)
        .map((d) => d.filename);
      const dup = existingNames.includes(file.name);
      if (dup) {
        displayName = uniqueCopyFilename(file.name, existingNames);
        if (
          !window.confirm(
            `A file named "${file.name}" is already on file. Save this upload as "${displayName}"?`
          )
        ) {
          return;
        }
      }
    }
    setError('');
    setUploading(type);
    const form = new FormData();
    form.append('file', file);
    form.append('type', type);
    form.append('originalName', displayName);
    if (type === 'additional' && description != null) form.append('description', description);
    try {
      const res = await fetch(`${API}/documents/upload`, {
        method: 'POST',
        headers: headers(),
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setDocuments(prev => [data, ...prev]);
      if (type === 'additional') {
        setAdditionalFile(null);
        setAdditionalDesc('');
        setAdditionalInputKey((k) => k + 1);
      }
    } catch (e) {
      setError(e.message || 'Upload failed');
    } finally {
      setUploading(null);
    }
  }

  async function handleDelete(id) {
    if (uploadsLocked) return;
    setError('');
    try {
      const res = await fetch(`${API}/documents/${id}`, { method: 'DELETE', headers: headers() });
      if (!res.ok) throw new Error('Delete failed');
      setDocuments(prev => prev.filter(d => d.id !== id));
      setAdditionalInputKey((k) => k + 1);
    } catch (e) {
      setError(e.message || 'Delete failed');
    }
  }

  async function handleSubmitApplication(e) {
    e?.preventDefault();
    if (!hasRequiredDocs || activeCase) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/cases`, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Submit failed');
      const [docsRes, casesRes] = await Promise.all([
        fetch(`${API}/documents`, { headers: headers() }),
        fetch(`${API}/cases`, { headers: headers() }),
      ]);
      const docsData = await docsRes.json();
      const casesData = casesRes.ok ? await casesRes.json() : { cases: [] };
      ingestDocumentsPayload(docsData, casesData.cases || []);
    } catch (e) {
      setError(e.message || 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResubmit(e) {
    e?.preventDefault();
    if (!activeCase || activeCase.status !== 'needs_info' || !hasRequiredDocs) return;
    setError('');
    setResubmitting(true);
    try {
      const res = await fetch(`${API}/cases/${activeCase.id}/resubmit`, {
        method: 'PATCH',
        headers: headers(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Resubmit failed');
      const [docsRes, casesRes] = await Promise.all([
        fetch(`${API}/documents`, { headers: headers() }),
        fetch(`${API}/cases`, { headers: headers() }),
      ]);
      const docsData = await docsRes.json();
      const casesData = casesRes.ok ? await casesRes.json() : { cases: [] };
      ingestDocumentsPayload(docsData, casesData.cases || []);
    } catch (e) {
      setError(e.message || 'Resubmit failed');
    } finally {
      setResubmitting(false);
    }
  }

  async function handleWithdraw(e) {
    e?.preventDefault();
    if (!activeCase || !WITHDRAWABLE_STATUSES.includes(activeCase.status)) return;
    if (!window.confirm('Withdraw this application? You will not be reviewed further for this submission.')) return;
    setError('');
    setWithdrawing(true);
    try {
      const res = await fetch(`${API}/cases/${activeCase.id}/withdraw`, {
        method: 'PATCH',
        headers: headers(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Withdraw failed');
      const [docsRes, casesRes] = await Promise.all([
        fetch(`${API}/documents`, { headers: headers() }),
        fetch(`${API}/cases`, { headers: headers() }),
      ]);
      const docsData = await docsRes.json();
      const casesData = casesRes.ok ? await casesRes.json() : { cases: [] };
      ingestDocumentsPayload(docsData, casesData.cases || []);
    } catch (err) {
      setError(err.message || 'Withdraw failed');
    } finally {
      setWithdrawing(false);
    }
  }

  async function handleSaveMessage(e) {
    e.preventDefault();
    setError('');
    setMessageSaving(true);
    try {
      const res = await fetch(`${API}/documents/message`, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      setMessages(prev => [data, ...prev].slice(0, 10));
      setMessage('');
    } catch (e) {
      setError(e.message || 'Failed to send message');
    } finally {
      setMessageSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <p>Loading…</p>
      </div>
    );
  }

  function studentStatusBadgeClass(status) {
    switch (status) {
      case 'submitted':
        return styles.badgeSubmitted;
      case 'assigned':
        return styles.badgeAssigned;
      case 'under_review':
      case 'resubmitted':
      case 'overdue':
        return styles.badgeUnderReview;
      case 'pending_admin_approval':
        return styles.badgePendingAdmin;
      case 'needs_info':
        return styles.badgeNeedsInfo;
      case 'approved':
        return styles.badgeApproved;
      case 'rejected':
        return styles.badgeRejected;
      case 'withdrawn':
        return styles.badgeWithdrawn;
      default:
        return styles.badgeDefault;
    }
  }

  const completedCases = myCases.filter((c) =>
    c.status === 'approved' || c.status === 'rejected' || c.status === 'withdrawn'
  );
  const studentOwnedDocs = documents.filter((d) => !d.uploaded_by);
  /** New student: committee has not enabled upload and no files yet — simple prompt, no empty upload UI */
  const awaitingAdminFirstUpload = !isApproved && studentOwnedDocs.length === 0;
  const checklist = countRequiredDocsUploaded(documents);

  function uploadLockedCopy(reason) {
    if (reason === 'committee_disabled') {
      return 'Your package appears complete and the uploading function is closed. Contact admin if there are questions.';
    }
    if (reason === 'final_approved') {
      return 'Your application has been approved. You can no longer upload or remove documents. You can still preview or download your files below.';
    }
    if (reason === 'submitted_pending_assignment') {
      return 'You have submitted your application. Your document package is locked until the committee asks for more information. You can still message the committee below.';
    }
    if (reason === 'application_rejected') {
      return 'Uploads are closed after a decision on your application. Contact the committee if you need to start a new review cycle.';
    }
    if (reason === 'withdrawn') {
      return 'This application was withdrawn. Uploads stay closed for this submission.';
    }
    if (reason === 'case_in_review') {
      return 'Your case is in review. Uploading is closed until the committee asks for more information. You can still send messages to the committee below, and preview or download your files.';
    }
    return 'You cannot upload or remove documents right now. You can still message the committee below and preview or download your files.';
  }

  return (
    <div className={styles.page}>
      <h2 className={styles.heading}>Upload documents for admission</h2>

      {awaitingAdminFirstUpload ? (
        <>
          <div className={styles.awaitingAdminCard} role="status">
            <p>
              The expert will enable you to upload your files. Message the committee and admin/expert will get back to you soon.
            </p>
          </div>
          {error && <div className={styles.error}>{error}</div>}
          {clarifications.length > 0 && (
            <section className={styles.section}>
              <label className={styles.label}>Clarifications from committee</label>
              <ul className={styles.list}>
                {clarifications.map(c => (
                  <li key={c.id} className={styles.docItem}>
                    <div className={styles.docInfo}>
                      <span className={styles.docName}>{c.message}</span>
                      <span className={styles.docTime}>{c.from_email} · {formatDate(c.created_at, timezone)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className={styles.section}>
            <label className={styles.label}>Message to admission committee</label>
            <form onSubmit={handleSaveMessage}>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Message the admin…"
                className={styles.textarea}
                rows={4}
              />
              <button type="submit" className={styles.saveMsgBtn} disabled={messageSaving}>
                {messageSaving ? 'Sending…' : 'Send message'}
              </button>
            </form>
            {messages.length > 0 && (
              <div className={styles.msgHistory}>
                <p className={styles.msgHistoryTitle}>Previous Messages</p>
                {messages.map(m => (
                  <div key={m.id} className={styles.msgItem}>
                    <p className={styles.msgText}>{m.message}</p>
                    <p className={styles.msgMeta}>You · {formatDate(m.created_at, timezone)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <>
      {!isApproved && (
        <div className={styles.accessDisabledBanner} role="status">
          Upload access is disabled by the committee. You can still view your documents and message the committee below.
        </div>
      )}
      <p className={styles.hint}>
        {isApproved
          ? 'PDF, DOC, DOCX, or TXT (max 10MB each). Upload Statement of Purpose(SOP), Letter of recommendation(LOR), Resume, and Transcript, then submit your application.'
          : 'You can view your submitted files and message the committee. Enable upload is controlled by the committee.'}
      </p>

      <div className={styles.docChecklist} role="region" aria-label="Required documents">
        <div className={styles.docChecklistHeader}>
          <span className={styles.docChecklistTitle}>Document checklist</span>
          <span className={styles.docChecklistCount}>
            {checklist.uploaded} of {checklist.total} required documents uploaded
          </span>
        </div>
        <ul className={styles.docChecklistList}>
          {REQUIRED_SUBMISSION_SLOTS.map((slot) => {
            const has = documents.some((d) => d.type === slot.id && !d.uploaded_by);
            return (
              <li
                key={slot.id}
                className={has ? styles.docChecklistItemDone : styles.docChecklistItemMissing}
              >
                <span className={styles.docChecklistMark} aria-hidden>{has ? '✓' : '○'}</span>
                <span>{slot.label}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {showInProgressBanner && (
        <div className={styles.inProgressBanner} role="status">
          <span className={styles.inProgressBadge}>In progress</span>
          <p className={styles.inProgressText}>
            You are still working on your application. Complete your documents and submit your application when ready.
          </p>
        </div>
      )}

      {activeCase && (
        <div className={styles.caseStatusBanner}>
          <span className={styles.caseStageLabel}>Your application</span>
          <div className={styles.progressTrack} role="list" aria-label="Application progress">
            {PROGRESS_STEPS.map((step, i) => {
              const current = studentProgressStepIndex(activeCase.status);
              const done = i < current;
              const active = i === current;
              const stepLabel =
                step.key === 'queue' && activeCase.status === 'assigned'
                  ? 'Expert Assigned'
                  : step.key === 'review' && activeCase.status === 'pending_admin_approval'
                    ? 'Expert Approved'
                    : step.label;
              return (
                <div
                  key={step.key}
                  role="listitem"
                  className={`${styles.progressTrackStep} ${done ? styles.progressTrackStepDone : ''} ${active ? styles.progressTrackStepActive : ''}`}
                >
                  <span className={styles.progressTrackDot} aria-hidden />
                  <span className={styles.progressTrackLabel}>{stepLabel}</span>
                </div>
              );
            })}
          </div>
          <p className={styles.progressPlain} role="status">
            {studentCaseHeadline(activeCase.status)}
          </p>
          {studentCaseSubline(activeCase.status) && (
            <p className={styles.progressSubline}>{studentCaseSubline(activeCase.status)}</p>
          )}
          {studentTimelineHint(activeCase.status) && (
            <p className={styles.timelineHint}>{studentTimelineHint(activeCase.status)}</p>
          )}
          <div className={styles.caseStatusHeader}>
            <span className={styles.caseIdPill}>{activeCase.case_id}</span>
            <span className={`${styles.statusBadge} ${studentStatusBadgeClass(activeCase.status)}`}>
              {studentCaseHeadline(activeCase.status)}
            </span>
          </div>
          <div className={styles.caseStatusMeta}>
            {activeCase.due_at && (
              <span className={styles.caseDue}>
                Due: {formatDate(activeCase.due_at, timezone)}
                {new Date(activeCase.due_at) < new Date() && (
                  <span className={styles.overdueBadge}>Overdue</span>
                )}
              </span>
            )}
            {activeCase.status === 'needs_info' && (
              <>
                <span className={styles.statusHint}>Please provide the requested information and resubmit.</span>
                {hasRequiredDocs && canUploadDocuments && (
                  <button
                    type="button"
                    className={styles.submitBtn}
                    onClick={handleResubmit}
                    disabled={resubmitting}
                  >
                    {resubmitting ? 'Resubmitting…' : 'Resubmit'}
                  </button>
                )}
              </>
            )}
            {WITHDRAWABLE_STATUSES.includes(activeCase.status) && (
              <button
                type="button"
                className={styles.withdrawBtn}
                onClick={handleWithdraw}
                disabled={withdrawing}
              >
                {withdrawing ? 'Withdrawing…' : 'Withdraw application'}
              </button>
            )}
          </div>
        </div>
      )}
      {completedCases.length > 0 && !activeCase && (
        <div className={styles.caseStatusBanner}>
          <span className={styles.caseStageLabel}>Your application</span>
          <p className={styles.progressPlain} role="status">
            {studentCaseHeadline(completedCases[0].status)}
          </p>
          <div className={styles.caseStatusHeader}>
            <span className={styles.caseIdPill}>{completedCases[0].case_id}</span>
            <span
              className={`${styles.statusBadge} ${studentStatusBadgeClass(completedCases[0].status)}`}
            >
              {studentCaseHeadline(completedCases[0].status)}
            </span>
          </div>
          <div className={styles.caseStatusMeta}>
            {completedCases[0].approved_at && (
              <span className={styles.caseApprovedAt}>Processed {formatDate(completedCases[0].approved_at, timezone)}</span>
            )}
            {completedCases[0].rejected_at && (
              <span className={styles.caseRejectedAt}>Assessed {formatDate(completedCases[0].rejected_at, timezone)}</span>
            )}
            {completedCases[0].withdrawn_at && (
              <span className={styles.caseWithdrawnAt}>Withdrawn {formatDate(completedCases[0].withdrawn_at, timezone)}</span>
            )}
          </div>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {uploadsLocked && uploadDisabledReason !== 'committee_disabled' && (
        <p className={styles.uploadLockedNote} role="status">
          {uploadLockedCopy(uploadDisabledReason)}
        </p>
      )}

      <div className={styles.sections}>
        {DOC_TYPES.map(({ id, label }) => {
          const list = documents.filter(d => d.type === id && !d.uploaded_by);
          const isUploading = uploading === id;
          const isAdditional = id === 'additional';
          return (
            <section key={id} className={styles.section}>
              <label className={styles.label}>{label}</label>
              {isAdditional ? (
                !uploadsLocked && (
                  <div className={styles.additionalUpload}>
                    <div className={styles.row}>
                      <input
                        key={additionalInputKey}
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        className={styles.fileInput}
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          setAdditionalFile(f);
                          // Reset so choosing the same file again fires change on the next pick
                          e.target.value = '';
                        }}
                        disabled={isUploading}
                      />
                      {additionalFile && (
                        <span className={styles.selectedFileLabel}>{additionalFile.name}</span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Short description (e.g. Research paper, Certificate)"
                      value={additionalDesc}
                      onChange={e => setAdditionalDesc(e.target.value)}
                      className={styles.descInput}
                      disabled={isUploading}
                      maxLength={200}
                    />
                    <button
                      type="button"
                      className={styles.uploadBtn}
                      onClick={() => additionalFile && handleUpload(id, additionalFile, additionalDesc)}
                      disabled={!additionalFile || isUploading}
                    >
                      {isUploading ? 'Uploading…' : 'Upload'}
                    </button>
                  </div>
                )
              ) : (
                !uploadsLocked && (
                  <div className={styles.row}>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      className={styles.fileInput}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) handleUpload(id, f);
                      }}
                      disabled={isUploading}
                    />
                    {isUploading && <span className={styles.status}>Uploading…</span>}
                  </div>
                )
              )}
              {list.length > 0 && (
                <ul className={styles.list}>
                  {list.map(doc => (
                    <li key={doc.id} className={styles.docItem}>
                      <div className={styles.docInfo}>
                        <span className={styles.docName}>
                          {doc.filename}
                          {doc.version > 1 && <span className={styles.versionBadge}> v{doc.version}</span>}
                        </span>
                        {isAdditional && doc.description && (
                          <span className={styles.docDesc}>{doc.description}</span>
                        )}
                        {doc.created_at && (
                          <span className={styles.docTime}>Uploaded {formatDate(doc.created_at, timezone)}</span>
                        )}
                      </div>
                      <div className={styles.docActions}>
                        <button
                          type="button"
                          className={styles.previewLink}
                          onClick={() => setPreviewDoc({ docId: doc.id, filename: doc.filename })}
                        >
                          Preview
                        </button>
                        <a
                          href={downloadUrl(doc.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.downloadLink}
                        >
                          Download
                        </a>
                        {!uploadsLocked && (
                          <button
                            type="button"
                            className={styles.removeBtn}
                            onClick={() => handleDelete(doc.id)}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}

        {(() => {
          const committeeFeedback = documents.filter(d => d.uploaded_by != null || d.type === 'feedback');
          const showCommitteeSection =
            committeeFeedback.length > 0 ||
            uploadDisabledReason === 'committee_disabled' ||
            !isApproved;
          if (!showCommitteeSection) return null;
          return (
            <section className={styles.section}>
              <label className={styles.label}>Committee feedback</label>
              <p className={styles.feedbackHint}>Comments, edits, or critiques from the admission committee.</p>
              {(!isApproved || uploadDisabledReason === 'committee_disabled') && (
                <p className={styles.committeeClosedMsg} role="status">
                  Your package appears complete and the uploading function is closed. Contact admin if there are questions.
                </p>
              )}
              <ul className={styles.list}>
                {committeeFeedback.map(doc => (
                  <li key={doc.id} className={styles.docItem}>
                    <div className={styles.docInfo}>
                      <span className={styles.docName}>{doc.filename}</span>
                      {doc.description && <span className={styles.docDesc}>{doc.description}</span>}
                      {doc.created_at && (
                        <span className={styles.docTime}>Uploaded {formatDate(doc.created_at, timezone)}</span>
                      )}
                    </div>
                    <div className={styles.docActions}>
                      <button
                        type="button"
                        className={styles.previewLink}
                        onClick={() => setPreviewDoc({ docId: doc.id, filename: doc.filename })}
                      >
                        Preview
                      </button>
                      <a
                        href={downloadUrl(doc.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.downloadLink}
                      >
                        Download
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })()}

        {!activeCase && hasRequiredDocs && isApproved && canUploadDocuments && !myCases.some((c) => c.status === 'approved') && (
          <section className={styles.section}>
            <label className={styles.label}>Submit application</label>
            <p className={styles.submitHint}>You have uploaded Statement of Purpose(SOP), Letter of recommendation(LOR), Resume, and Transcript. Click to create your application case.</p>
            <button
              type="button"
              className={styles.submitBtn}
              onClick={handleSubmitApplication}
              disabled={submitting}
            >
              {submitting ? 'Submitting…' : 'Submit application'}
            </button>
          </section>
        )}

        {clarifications.length > 0 && (
          <section className={styles.section}>
            <label className={styles.label}>Clarifications from committee</label>
            <ul className={styles.list}>
              {clarifications.map(c => (
                <li key={c.id} className={styles.docItem}>
                  <div className={styles.docInfo}>
                    <span className={styles.docName}>{c.message}</span>
                    <span className={styles.docTime}>{c.from_email} · {formatDate(c.created_at, timezone)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={styles.section}>
          <label className={styles.label}>Message to admission committee</label>
          {uploadsLocked && uploadDisabledReason !== 'committee_disabled' && (
            <p className={styles.messageHint} role="status">
              You can always send messages here, even while uploads are closed.
            </p>
          )}
          <form onSubmit={handleSaveMessage}>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Optional message to the admission committee…"
              className={styles.textarea}
              rows={4}
            />
            <button type="submit" className={styles.saveMsgBtn} disabled={messageSaving}>
              {messageSaving ? 'Sending…' : 'Send message'}
            </button>
          </form>
          {messages.length > 0 && (
            <div className={styles.msgHistory}>
              <p className={styles.msgHistoryTitle}>Previous Messages</p>
              {messages.map(m => (
                <div key={m.id} className={styles.msgItem}>
                  <p className={styles.msgText}>{m.message}</p>
                  <p className={styles.msgMeta}>You · {formatDate(m.created_at, timezone)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
        </>
      )}

      {previewDoc && (
        <div className={styles.previewOverlay} onClick={() => setPreviewDoc(null)} role="dialog" aria-modal="true" aria-label="Document preview">
          <div className={styles.previewModal} onClick={e => e.stopPropagation()}>
            <div className={styles.previewModalHeader}>
              <span className={styles.previewModalTitle}>{previewDoc.filename}</span>
              <button type="button" className={styles.previewModalClose} onClick={() => setPreviewDoc(null)} aria-label="Close">×</button>
            </div>
            <div className={styles.previewModalBody}>
              {/\.pdf$/i.test(previewDoc.filename) ? (
                <iframe src={previewUrl(previewDoc.docId)} title={previewDoc.filename} className={styles.previewIframe} />
              ) : /\.txt$/i.test(previewDoc.filename) ? (
                <iframe src={previewUrl(previewDoc.docId)} title={previewDoc.filename} className={styles.previewIframe} />
              ) : (
                <div className={styles.previewFallback}>
                  <p>Preview may not be available for this file type.</p>
                  <a href={previewUrl(previewDoc.docId)} target="_blank" rel="noopener noreferrer" className={styles.downloadLink}>Open in new tab</a>
                  <a href={downloadUrl(previewDoc.docId)} target="_blank" rel="noopener noreferrer" className={styles.downloadLink}>Download</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
