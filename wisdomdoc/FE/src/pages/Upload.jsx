import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../config';
import { formatDate } from '../utils/dateFormat';
import styles from './Upload.module.css';

const DOC_TYPES = [
  { id: 'sop', label: 'Statement of Purpose (SOP)' },
  { id: 'lor', label: 'Letter of Recommendation (LOR)' },
  { id: 'resume', label: 'Resume' },
  { id: 'transcript', label: 'Transcript' },
  { id: 'additional', label: 'Additional files' },
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

  const headers = () => ({ Authorization: `Bearer ${token}` });

  const downloadUrl = (docId) =>
    `${API}/documents/${docId}/download?token=${encodeURIComponent(token)}`;
  const previewUrl = (docId) =>
    `${API}/documents/${docId}/preview?token=${encodeURIComponent(token)}`;

  const requiredTypes = ['sop', 'lor', 'resume'];
  const hasRequiredDocs = requiredTypes.every(
    (t) => documents.some((d) => d.type === t && !d.uploaded_by)
  );
  const activeCase = myCases.find((c) => c.status !== 'approved' && c.status !== 'rejected');
  const hasFinalApprovedCase = myCases.some((c) => c.status === 'approved');
  /** Before first submit (or after reject while preparing again) — not when a workflow case exists */
  const showInProgressBanner = isApproved && !activeCase && !hasFinalApprovedCase;
  /** No new uploads or removals after final case approval */
  const uploadsLocked = hasFinalApprovedCase;

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
          setDocuments(docsData.documents || []);
          setIsApproved(!!docsData.isApproved);
          setMessages(docsData.messages || []);
          setClarifications(docsData.clarifications || []);
          setTimezone(docsData.timezone || 'America/Chicago');
          setMyCases(casesData.cases || []);
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
    setError('');
    setUploading(type);
    const form = new FormData();
    form.append('file', file);
    form.append('type', type);
    form.append('originalName', file.name);
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
      setMyCases((prev) => [{ ...data, status: 'submitted' }, ...prev]);
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
      setMyCases((prev) => prev.map((c) => c.id === activeCase.id ? { ...c, ...data, status: 'resubmitted' } : c));
    } catch (e) {
      setError(e.message || 'Resubmit failed');
    } finally {
      setResubmitting(false);
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

  if (!isApproved) {
    return (
      <div className={styles.page}>
        <div className={styles.notApproved}>
          <h2 className={styles.heading}>Upload not available</h2>
          <p>Only selected students can add files. You have not been selected yet. Contact the admission committee.</p>
        </div>
      </div>
    );
  }

  const STATUS_LABELS = {
    draft: 'Draft',
    submitted: 'Submitted',
    assigned: 'Assigned',
    under_review: 'Under review',
    needs_info: 'Needs info',
    resubmitted: 'Resubmitted',
    pending_admin_approval: 'Pending admin approval',
    approved: 'Approved',
    rejected: 'Rejected',
    overdue: 'Overdue',
  };
  const BADGE_CLASS = {
    draft: styles.badgeDraft,
    submitted: styles.badgeSubmitted,
    assigned: styles.badgeAssigned,
    under_review: styles.badgeUnderReview,
    needs_info: styles.badgeNeedsInfo,
    resubmitted: styles.badgeResubmitted,
    pending_admin_approval: styles.badgePendingAdmin,
    approved: styles.badgeApproved,
    rejected: styles.badgeRejected,
    overdue: styles.badgeOverdue,
  };
  const completedCases = myCases.filter((c) => c.status === 'approved' || c.status === 'rejected');

  return (
    <div className={styles.page}>
      <h2 className={styles.heading}>Upload documents for admission</h2>
      <p className={styles.hint}>PDF, DOC, DOCX, or TXT (max 10MB each). Upload SOP, LOR, and Resume, then submit your application.</p>

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
          <span className={styles.caseStageLabel}>Case stage</span>
          <div className={styles.caseStatusHeader}>
            <span className={styles.caseIdPill}>{activeCase.case_id}</span>
            {activeCase.status === 'pending_admin_approval' ? (
              <div className={styles.dualStatusRow} role="status" aria-label="Examiner approved, pending admin">
                <span className={styles.statusRectApproved}>Approved</span>
                <span className={styles.statusRectPendingAdmin}>Pending Admin Approval</span>
              </div>
            ) : (
              <span className={`${styles.statusBadge} ${BADGE_CLASS[activeCase.status] || styles.badgeDefault}`}>
                {STATUS_LABELS[activeCase.status] || activeCase.status}
              </span>
            )}
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
            {activeCase.status === 'pending_admin_approval' && (
              <p className={styles.tentativeApprovalHint}>
                Examiner has approved your application. Final confirmation from the authority is still required. You will be notified when the decision is complete.
              </p>
            )}
            {activeCase.status === 'needs_info' && (
              <>
                <span className={styles.statusHint}>Please provide the requested information and resubmit.</span>
                {hasRequiredDocs && (
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
          </div>
        </div>
      )}
      {completedCases.length > 0 && !activeCase && (
        <div className={styles.caseStatusBanner}>
          <span className={styles.caseStageLabel}>Case stage</span>
          <div className={styles.caseStatusHeader}>
            <span className={styles.caseIdPill}>{completedCases[0].case_id}</span>
            <span className={`${styles.statusBadge} ${completedCases[0].status === 'approved' ? styles.badgeApproved : styles.badgeRejected}`}>
              {STATUS_LABELS[completedCases[0].status]}
            </span>
          </div>
          <div className={styles.caseStatusMeta}>
            {completedCases[0].approved_at && (
              <span className={styles.caseApprovedAt}>Processed {formatDate(completedCases[0].approved_at, timezone)}</span>
            )}
            {completedCases[0].rejected_at && (
              <span className={styles.caseRejectedAt}>Assessed {formatDate(completedCases[0].rejected_at, timezone)}</span>
            )}
          </div>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {uploadsLocked && (
        <p className={styles.uploadLockedNote} role="status">
          Your application has been approved. You can no longer upload or remove documents. You can still preview or download your files below.
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
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        className={styles.fileInput}
                        onChange={e => setAdditionalFile(e.target.files?.[0] || null)}
                        disabled={isUploading}
                      />
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
                      onChange={e => handleUpload(id, e.target.files?.[0])}
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
          if (committeeFeedback.length === 0) return null;
          return (
            <section className={styles.section}>
              <label className={styles.label}>Committee feedback</label>
              <p className={styles.feedbackHint}>Comments, edits, or critiques from the admission committee.</p>
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

        {!activeCase && hasRequiredDocs && isApproved && !myCases.some((c) => c.status === 'approved') && (
          <section className={styles.section}>
            <label className={styles.label}>Submit application</label>
            <p className={styles.submitHint}>You have uploaded SOP, LOR, and Resume. Click to create your application case.</p>
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
