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

  const requiredTypes = ['sop', 'lor', 'resume'];
  const hasRequiredDocs = requiredTypes.every(
    (t) => documents.some((d) => d.type === t && !d.uploaded_by)
  );
  const activeCase = myCases.find((c) => c.status !== 'approved' && c.status !== 'rejected');
  const hasFinalApprovedCase = myCases.some((c) => c.status === 'approved');
  /** Before first submit (or after reject while preparing again) — not when a workflow case exists */
  const showInProgressBanner = isApproved && !activeCase && !hasFinalApprovedCase;
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
    const act = cases.find((c) => c.status !== 'approved' && c.status !== 'rejected');
    const fallbackCan =
      approved &&
      !hasApprovedCase &&
      (!act || act.status === 'needs_info' || act.status === 'submitted');
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
  const studentOwnedDocs = documents.filter((d) => !d.uploaded_by);
  /** New student: committee has not enabled upload and no files yet — simple prompt, no empty upload UI */
  const awaitingAdminFirstUpload = !isApproved && studentOwnedDocs.length === 0;

  function uploadLockedCopy(reason) {
    if (reason === 'committee_disabled') {
      return 'Your package appears complete and the uploading function is closed. Contact admin if there are questions.';
    }
    if (reason === 'final_approved') {
      return 'Your application has been approved. You can no longer upload or remove documents. You can still preview or download your files below.';
    }
    if (reason === 'case_in_review') {
      return 'Your case has been assigned for review (or is in a review stage). Uploading is closed until the committee asks for more information. You can still send messages to the committee below, and preview or download your files.';
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
          ? 'PDF, DOC, DOCX, or TXT (max 10MB each). Upload SOP, LOR, and Resume, then submit your application.'
          : 'You can view your submitted files and message the committee. Enable upload is controlled by the committee.'}
      </p>

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
