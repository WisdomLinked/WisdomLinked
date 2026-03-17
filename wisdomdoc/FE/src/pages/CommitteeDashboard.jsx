import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../config';
import { formatDate } from '../utils/dateFormat';
import styles from './CommitteeDashboard.module.css';

const DOC_LABELS = { sop: 'SOP', lor: 'LOR', resume: 'Resume', transcript: 'Transcript', additional: 'Additional files', feedback: 'Committee feedback' };

export default function CommitteeDashboard() {
  const { token, user } = useAuth();
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [myMajors, setMyMajors] = useState('');
  const [savingMajors, setSavingMajors] = useState(false);
  const isExpert = user?.role === 'expert';
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [enablingAll, setEnablingAll] = useState(false);
  const [disablingAll, setDisablingAll] = useState(false);
  const [feedbackFile, setFeedbackFile] = useState(null);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [feedbackUploading, setFeedbackUploading] = useState(false);
  const [clarifySending, setClarifySending] = useState(false);
  const [error, setError] = useState('');
  const [showBio, setShowBio] = useState(() => {
    try { return localStorage.getItem('wisdomdoc_showBio') !== '0'; } catch { return true; }
  });

  const headers = () => ({ Authorization: `Bearer ${token}` });

  function toggleShowBio() {
    setShowBio(prev => {
      const next = !prev;
      try { localStorage.setItem('wisdomdoc_showBio', String(next)); } catch (_) {}
      return next;
    });
  }

  function loadStudents() {
    fetch(`${API}/committee/students`, { headers: headers() })
      .then(r => r.json())
      .then(data => setStudents(data.students || []));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/committee/students`, { headers: headers() });
        if (!res.ok) throw new Error('Failed to load students');
        const data = await res.json();
        if (!cancelled) setStudents(data.students || []);
        if (user?.role === 'expert') {
          try {
            const me = await fetch(`${API}/committee/me`, { headers: headers() }).then(r => r.json());
            if (!cancelled && me?.majors?.length) setMyMajors(me.majors.join(', '));
          } catch (_) {}
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load students');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, user?.role]);

  async function saveMyMajors(e) {
    e?.preventDefault();
    const majors = myMajors.split(',').map(m => m.trim()).filter(Boolean);
    setSavingMajors(true);
    try {
      await fetch(`${API}/committee/me`, {
        method: 'PATCH',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ majors }),
      });
      loadStudents();
    } finally {
      setSavingMajors(false);
    }
  }

  async function enableAll() {
    setError('');
    setEnablingAll(true);
    try {
      const res = await fetch(`${API}/committee/students/approve-all`, { method: 'PATCH', headers: headers() });
      if (!res.ok) throw new Error('Failed');
      loadStudents();
      if (selected) {
        const r = await fetch(`${API}/committee/students/${selected.id}`, { headers: headers() });
        setDetail(await r.json());
      }
    } catch (e) {
      setError(e.message || 'Failed');
    } finally {
      setEnablingAll(false);
    }
  }

  async function disableAll() {
    setError('');
    setDisablingAll(true);
    try {
      const res = await fetch(`${API}/committee/students/disable-all`, { method: 'PATCH', headers: headers() });
      if (!res.ok) throw new Error('Failed');
      loadStudents();
      if (selected) {
        const r = await fetch(`${API}/committee/students/${selected.id}`, { headers: headers() });
        setDetail(await r.json());
      }
    } catch (e) {
      setError(e.message || 'Failed');
    } finally {
      setDisablingAll(false);
    }
  }

  async function toggleApproval(studentId) {
    try {
      const res = await fetch(`${API}/committee/students/${studentId}/approve`, { method: 'PATCH', headers: headers() });
      if (!res.ok) throw new Error('Failed');
      loadStudents();
      if (selected?.id === studentId) {
        const r = await fetch(`${API}/committee/students/${studentId}`, { headers: headers() });
        setDetail(await r.json());
      }
    } catch (e) {
      setError(e.message || 'Failed');
    }
  }

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    setDetailLoading(true);
    setError('');
    fetch(`${API}/committee/students/${selected.id}`, { headers: headers() })
      .then(r => r.json())
      .then(data => setDetail(data))
      .catch(() => setError('Could not load details'))
      .finally(() => setDetailLoading(false));
  }, [selected, token]);

  const downloadUrl = (studentId, docId) =>
    `${API}/committee/students/${studentId}/documents/${docId}/download?token=${encodeURIComponent(token)}`;

  const docLabel = (type) => DOC_LABELS[type || ''] || type || 'Document';

  async function handleSendFeedback(e) {
    e?.preventDefault();
    if (!selected) return;
    if (feedbackFile) {
      setError('');
      setFeedbackUploading(true);
      const form = new FormData();
      form.append('file', feedbackFile);
      form.append('originalName', feedbackFile.name);
      if (feedbackNote.trim()) form.append('description', feedbackNote.trim());
      try {
        const res = await fetch(`${API}/committee/students/${selected.id}/feedback`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        if (!res.ok) throw new Error('Failed to send');
        setFeedbackFile(null);
        setFeedbackNote('');
        const r = await fetch(`${API}/committee/students/${selected.id}`, { headers: headers() });
        setDetail(await r.json());
      } catch (err) {
        setError(err.message || 'Failed to send');
      } finally {
        setFeedbackUploading(false);
      }
    } else if (feedbackNote.trim()) {
      setError('');
      setClarifySending(true);
      try {
        const res = await fetch(`${API}/committee/students/${selected.id}/clarify`, {
          method: 'POST',
          headers: { ...headers(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: feedbackNote.trim() }),
        });
        if (!res.ok) throw new Error('Failed to send');
        setFeedbackNote('');
        const r = await fetch(`${API}/committee/students/${selected.id}`, { headers: headers() });
        setDetail(await r.json());
      } catch (err) {
        setError(err.message || 'Failed to send');
      } finally {
        setClarifySending(false);
      }
    }
  }

  if (loading) {
    return <div className={styles.loading}><p>Loading students…</p></div>;
  }

  return (
    <div className={styles.page}>
      <h2 className={styles.heading}>Student submissions</h2>
      <p className={styles.hint}>Click on a student record to see their uploaded documents and message to the committee.</p>

      {error && <div className={styles.error}>{error}</div>}

      {students.length > 0 && (
        <div className={styles.bulkActions}>
          <button type="button" className={styles.enableAllBtn} onClick={enableAll} disabled={enablingAll || disablingAll}>
            {enablingAll ? 'Enabling…' : 'Enable upload for all'}
          </button>
          <button type="button" className={styles.disableAllBtn} onClick={disableAll} disabled={enablingAll || disablingAll}>
            {disablingAll ? 'Disabling…' : 'Disable upload for all'}
          </button>
        </div>
      )}

      <div className={`${styles.grid} ${!isExpert ? styles.gridTwoCol : ''}`}>
        <aside className={styles.sidebar}>
          <ul className={styles.studentList}>
            {students.length === 0 ? (
              <li className={styles.empty}>No students yet</li>
            ) : (
              students.map((s) => (
                <li key={s.id} className={styles.studentListItem}>
                  <button
                    type="button"
                    className={selected?.id === s.id ? styles.studentBtnActive : styles.studentBtn}
                    onClick={() => setSelected(s)}
                  >
                    <span className={styles.studentEmail}>{s.email}</span>
                    <span className={styles.studentMeta}>
                      {s.major || 'No major'} · {s.approved ? '✓' : '–'} · {s.doc_count} doc{s.doc_count !== 1 ? 's' : ''}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={s.approved ? styles.approveBtnOn : styles.approveBtn}
                    onClick={(e) => { e.stopPropagation(); toggleApproval(s.id); }}
                    title={s.approved ? 'Disable upload for student' : 'Enable upload for student'}
                  >
                    {s.approved ? 'Disable upload' : 'Enable upload'}
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>
        <section className={styles.detail}>
          {!selected && <p className={styles.placeholder}>Select a student</p>}
          {selected && detailLoading && <p className={styles.placeholder}>Loading…</p>}
          {selected && detail && !detailLoading && detail.student && (
            <>
              <div className={styles.detailHeader}>
                <h3 className={styles.detailTitle}>Profile</h3>
                <button
                  type="button"
                  className={detail.student.approved ? styles.approveBtnOn : styles.approveBtn}
                  onClick={() => toggleApproval(detail.student.id)}
                >
                  {detail.student.approved ? 'Disable upload' : 'Enable upload'}
                </button>
              </div>

              <div className={styles.profilePanel}>
                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>Major</span>
                  <span className={styles.profileValue}>{detail.student.major ? <span className={styles.profileTag}>{detail.student.major}</span> : '—'}</span>
                </div>
                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>Bio</span>
                  <div className={styles.profileBio}>{showBio && detail.student.bio ? detail.student.bio : '—'}</div>
                </div>
                <label className={styles.showBioLabel}>
                  <input
                    type="checkbox"
                    checked={showBio}
                    onChange={e => {
                      const v = e.target.checked;
                      setShowBio(v);
                      localStorage.setItem('wisdomdoc_showBio', v ? '1' : '0');
                    }}
                  />
                  <span>Show bio when available</span>
                </label>
              </div>

              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Documents</h4>
                {(() => {
                  const studentDocs = (detail.documents || []).filter(d => !d.uploaded_by);
                  if (!studentDocs.length) return <p className={styles.empty}>No documents uploaded</p>;
                  return (
                  <ul className={styles.docList}>
                    {studentDocs.map((doc) => (
                      <li key={doc.id} className={styles.docItem}>
                        <div className={styles.docInfo}>
                          <div className={styles.docRow}>
                            <span className={styles.docType}>{docLabel(doc.type)}</span>
                            <span className={styles.docName}>{doc.filename}</span>
                          </div>
                          {(doc.type === 'additional' || doc.type === 'feedback') && doc.description && (
                            <span className={styles.docDesc}>{doc.description}</span>
                          )}
                          {doc.created_at && (
                            <span className={styles.docTime}>{doc.uploaded_by ? 'Feedback uploaded' : 'Uploaded'} {formatDate(doc.created_at, detail.student?.timezone)}</span>
                          )}
                        </div>
                        <a href={downloadUrl(detail.student.id, doc.id)} target="_blank" rel="noopener noreferrer" className={styles.downloadLink}>Download</a>
                      </li>
                    ))}
                  </ul>
                  );
                })()}
              </div>

              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Feedbacks For Student</h4>
                {(() => {
                  const fileFeedback = (detail.documents || []).filter(d => d.uploaded_by).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                  const textFeedback = (detail.clarifications || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                  const hasAny = fileFeedback.length > 0 || textFeedback.length > 0;
                  if (!hasAny) return null;
                  return (
                    <div className={styles.clarifyHistory}>
                      {fileFeedback.map(doc => (
                        <div key={`fb-${doc.id}`} className={styles.clarifyItem}>
                          <div className={styles.docRow}>
                            <span className={styles.docName}>{doc.filename}</span>
                            <a href={downloadUrl(detail.student.id, doc.id)} target="_blank" rel="noopener noreferrer" className={styles.downloadLink}>Download</a>
                          </div>
                          {doc.description && <span className={styles.docDesc}>{doc.description}</span>}
                          <p className={styles.clarifyMeta}>Feedback uploaded · {formatDate(doc.created_at, detail.student?.timezone)}</p>
                        </div>
                      ))}
                      {textFeedback.map(c => (
                        <div key={`cl-${c.id}`} className={styles.clarifyItem}>
                          <p className={styles.clarifyText}>{c.message}</p>
                          <p className={styles.clarifyMeta}>{c.from_email} · {formatDate(c.created_at, detail.student?.timezone)}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                <p className={styles.extraHint}>Provide text-only feedback.</p>
                <div className={styles.feedbackForm}>
                  <textarea
                    placeholder="e.g. Your LOR is missing. Files incomplete—please upload a complete resume."
                    value={feedbackNote}
                    onChange={e => setFeedbackNote(e.target.value)}
                    className={styles.clarifyTextarea}
                    rows={3}
                    disabled={feedbackUploading || clarifySending}
                    maxLength={500}
                  />
                  <div className={styles.feedbackActions}>
                    <input type="file" accept=".pdf,.doc,.docx,.txt" className={styles.fileInput}
                      onChange={e => setFeedbackFile(e.target.files?.[0] || null)} disabled={feedbackUploading || clarifySending} />
                    <button type="button" onClick={handleSendFeedback} className={styles.addTypeBtn}
                      disabled={(!feedbackFile && !feedbackNote.trim()) || feedbackUploading || clarifySending}>
                      {(feedbackUploading || clarifySending) ? 'Sending…' : 'Send Feedback'}
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Messages from student</h4>
                {!detail.messages?.length ? (
                  <p className={styles.empty}>No messages yet</p>
                ) : (
                  <div className={styles.msgList}>
                    {(detail.messages || []).map(m => (
                      <div key={m.id} className={styles.messageBox}>
                        <p className={styles.messageText}>{m.message}</p>
                        <p className={styles.messageMeta}>{m.created_at && formatDate(m.created_at, detail.student?.timezone)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {isExpert && (
          <aside className={styles.extraTypesPanel}>
            <div className={styles.myMajorsSection}>
              <h4 className={styles.sectionTitle}>My majors</h4>
              <p className={styles.extraHint}>Students with these majors will appear in your list.</p>
              <form onSubmit={saveMyMajors}>
                <input type="text" placeholder="CS, ECE, etc." value={myMajors} onChange={e => setMyMajors(e.target.value)} className={styles.addTypeInput} />
                <button type="submit" className={styles.addTypeBtn} disabled={savingMajors}>{savingMajors ? 'Saving…' : 'Save'}</button>
              </form>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
