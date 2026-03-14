import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../config';
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
  const [documents, setDocuments] = useState([]);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isApproved, setIsApproved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null);
  const [messageSaving, setMessageSaving] = useState(false);
  const [error, setError] = useState('');
  const [additionalFile, setAdditionalFile] = useState(null);
  const [additionalDesc, setAdditionalDesc] = useState('');

  const headers = () => ({ Authorization: `Bearer ${token}` });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/documents`, { headers: headers() });
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        if (!cancelled) {
          setDocuments(data.documents || []);
          setIsApproved(!!data.isApproved);
          setMessages(data.messages || []);
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
    if (!file) return;
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
    setError('');
    try {
      const res = await fetch(`${API}/documents/${id}`, { method: 'DELETE', headers: headers() });
      if (!res.ok) throw new Error('Delete failed');
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (e) {
      setError(e.message || 'Delete failed');
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
      setMessages(prev => [data, ...prev]);
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

  return (
    <div className={styles.page}>
      <h2 className={styles.heading}>Upload documents for admission</h2>
      <p className={styles.hint}>PDF, DOC, DOCX, or TXT (max 10MB each).</p>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.sections}>
        {DOC_TYPES.map(({ id, label }) => {
          const list = documents.filter(d => d.type === id && !d.uploaded_by);
          const isUploading = uploading === id;
          const isAdditional = id === 'additional';
          return (
            <section key={id} className={styles.section}>
              <label className={styles.label}>{label}</label>
              {isAdditional ? (
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
              ) : (
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
              )}
              {list.length > 0 && (
                <ul className={styles.list}>
                  {list.map(doc => (
                    <li key={doc.id} className={styles.docItem}>
                      <div className={styles.docInfo}>
                        <span className={styles.docName}>{doc.filename}</span>
                        {isAdditional && doc.description && (
                          <span className={styles.docDesc}>{doc.description}</span>
                        )}
                        {doc.created_at && (
                          <span className={styles.docTimestamp}>{new Date(doc.created_at).toLocaleString()}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => handleDelete(doc.id)}
                      >
                        Remove
                      </button>
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
                {committeeFeedback.map(doc => {
                  const isTextOnly = doc.filename === 'Committee note.txt';
                  const text = doc.description || (isTextOnly ? '' : doc.filename);
                  return (
                    <li key={doc.id} className={styles.feedbackItem}>
                      {isTextOnly ? (
                        <>
                          <p className={styles.feedbackComment}>{doc.description || text}</p>
                          {doc.created_at && (
                            <span className={styles.docTimestamp}>{new Date(doc.created_at).toLocaleString()}</span>
                          )}
                        </>
                      ) : (
                        <>
                          {doc.description && (
                            <p className={styles.feedbackComment}>{doc.description}</p>
                          )}
                          <div className={styles.feedbackDocRow}>
                            <div className={styles.feedbackDocInfo}>
                              <span className={styles.docName}>{doc.filename}</span>
                              {doc.created_at && (
                                <span className={styles.docTimestamp}>{new Date(doc.created_at).toLocaleString()}</span>
                              )}
                            </div>
                            <a
                              href={`${API}/documents/${doc.id}/download?token=${encodeURIComponent(token)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.downloadLink}
                            >
                              Download
                            </a>
                          </div>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })()}

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
            <button type="submit" className={styles.saveMsgBtn} disabled={messageSaving || !message.trim()}>
              {messageSaving ? 'Sending…' : 'Send message'}
            </button>
          </form>
          {messages.length > 0 && (
            <div className={styles.messagesHistory}>
              <p className={styles.messagesHistoryTitle}>Old messages to committee</p>
              <ul className={styles.messagesList}>
                {messages.slice(0, 10).map(m => (
                  <li key={m.id} className={styles.messageItem}>
                    <p className={styles.messageText}>{m.message}</p>
                    <span className={styles.messageMeta}>{m.created_at && new Date(m.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
