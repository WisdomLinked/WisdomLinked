import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../config';
import { formatDate } from '../utils/dateFormat';
import styles from './CommitteeDashboard.module.css';

const DOC_LABELS = { sop: 'SOP', lor: 'LOR', resume: 'Resume', transcript: 'Transcript', additional: 'Additional files', feedback: 'Committee feedback' };
/** Order of document category headings under Documents */
const DOC_TYPE_ORDER = ['sop', 'lor', 'resume', 'transcript', 'additional'];
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
const PENDING_STATUSES = ['submitted', 'assigned', 'under_review', 'needs_info', 'resubmitted', 'pending_admin_approval'];

export default function CommitteeDashboard() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState('cases');
  const [cases, setCases] = useState([]);
  const [experts, setExperts] = useState([]);
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [myMajors, setMyMajors] = useState('');
  const [savingMajors, setSavingMajors] = useState(false);
  const isExpert = user?.role === 'expert';
  const isAdmin = user?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [enablingAll, setEnablingAll] = useState(false);
  const [disablingAll, setDisablingAll] = useState(false);
  const [feedbackFile, setFeedbackFile] = useState(null);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [feedbackUploading, setFeedbackUploading] = useState(false);
  const [clarifySending, setClarifySending] = useState(false);
  const [assigningExpert, setAssigningExpert] = useState(null);
  const [approvingCase, setApprovingCase] = useState(null);
  const [rejectingCase, setRejectingCase] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [caseUpdates, setCaseUpdates] = useState([]);
  const [expertsForCase, setExpertsForCase] = useState(null);
  const [error, setError] = useState('');
  const [previewDoc, setPreviewDoc] = useState(null);
  const headers = () => ({ Authorization: `Bearer ${token}` });

  function loadExpertsForCase(caseId) {
    if (!caseId || !isAdmin) return;
    fetch(`${API}/cases/experts?caseId=${caseId}`, { headers: headers() })
      .then(r => r.json())
      .then(data => setExpertsForCase(data.experts || []))
      .catch(() => setExpertsForCase([]));
  }

  function loadCases() {
    fetch(`${API}/cases`, { headers: headers() })
      .then(r => r.json())
      .then(data => setCases(data.cases || []));
  }

  function loadStudents() {
    fetch(`${API}/committee/students`, { headers: headers() })
      .then(r => r.json())
      .then(data => setStudents(data.students || []));
  }

  function loadExperts() {
    if (isAdmin) {
      fetch(`${API}/cases/experts`, { headers: headers() })
        .then(r => r.json())
        .then(data => setExperts(data.experts || []));
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (user?.role === 'expert' || user?.role === 'admin') {
          const [casesRes, studentsRes] = await Promise.all([
            fetch(`${API}/cases`, { headers: headers() }),
            fetch(`${API}/committee/students`, { headers: headers() }),
          ]);
          if (!cancelled) {
            const casesData = await casesRes.json();
            setCases(casesData.cases || []);
            const studentsData = await studentsRes.json();
            setStudents(studentsData.students || []);
          }
        }
        if (user?.role === 'admin') {
          const exRes = await fetch(`${API}/cases/experts`, { headers: headers() });
          const exData = await exRes.json();
          if (!cancelled) setExperts(exData.experts || []);
        }
        if (user?.role === 'expert') {
          try {
            const me = await fetch(`${API}/committee/me`, { headers: headers() }).then(r => r.json());
            if (!cancelled && me?.majors?.length) setMyMajors(me.majors.join(', '));
          } catch (_) {}
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, user?.role, isAdmin]);

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

  const studentIdForDetail = activeTab === 'cases' && selected?.student_id != null
    ? selected.student_id
    : selected?.id;

  useEffect(() => {
    if (!studentIdForDetail) { setDetail(null); return; }
    setDetailLoading(true);
    setError('');
    fetch(`${API}/committee/students/${studentIdForDetail}`, { headers: headers() })
      .then(r => r.json())
      .then(data => setDetail(data))
      .catch(() => setError('Could not load details'))
      .finally(() => setDetailLoading(false));
  }, [studentIdForDetail, token]);

  useEffect(() => {
    if (activeTab === 'cases' && selected?.id && isAdmin) {
      loadExpertsForCase(selected.id);
    } else {
      setExpertsForCase(null);
    }
  }, [activeTab, selected?.id, isAdmin]);

  useEffect(() => {
    if (activeTab === 'cases' && selected?.id) {
      loadCaseUpdates(selected.id);
    } else {
      setCaseUpdates([]);
    }
  }, [activeTab, selected?.id]);

  async function handleAssignExpert(caseId, expertId) {
    setError('');
    setAssigningExpert(caseId);
    try {
      const res = await fetch(`${API}/cases/${caseId}/assign`, {
        method: 'PATCH',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ expertId: expertId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      loadCases();
      if (selected?.id === caseId) {
        const expert = expertId ? expertsForCase?.find(e => e.id === expertId) : null;
        setSelected({
          ...selected,
          assigned_expert_id: expertId || null,
          expert_email: expert?.email,
          expert_username: expert?.username,
          status: expertId ? 'assigned' : 'submitted',
        });
      }
    } catch (e) {
      setError(e.message || 'Failed to assign');
    } finally {
      setAssigningExpert(null);
    }
  }

  async function handleApproveCase(caseId) {
    setError('');
    setApprovingCase(caseId);
    try {
      const res = await fetch(`${API}/cases/${caseId}/approve`, { method: 'PATCH', headers: headers() });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
      loadCases();
      if (selected?.id === caseId) setSelected(prev => prev ? { ...prev, status: 'pending_admin_approval' } : null);
    } catch (e) {
      setError(e.message || 'Failed to approve');
    } finally {
      setApprovingCase(null);
    }
  }

  async function handleRejectCase(caseId) {
    setError('');
    setRejectingCase(caseId);
    try {
      const res = await fetch(`${API}/cases/${caseId}/reject`, { method: 'PATCH', headers: headers() });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
      loadCases();
      if (selected?.id === caseId) setSelected(prev => prev ? { ...prev, status: 'rejected' } : null);
    } catch (e) {
      setError(e.message || 'Failed to reject');
    } finally {
      setRejectingCase(null);
    }
  }

  async function handleAdminStatusChange(caseId, newStatus) {
    setError('');
    setUpdatingStatus(caseId);
    try {
      const res = await fetch(`${API}/cases/${caseId}/status`, {
        method: 'PATCH',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
      loadCases();
      if (selected?.id === caseId) setSelected(prev => prev ? { ...prev, status: newStatus } : null);
    } catch (e) {
      setError(e.message || 'Failed');
    } finally {
      setUpdatingStatus(null);
    }
  }

  function loadCaseUpdates(caseId) {
    if (!caseId) return;
    fetch(`${API}/cases/${caseId}/updates`, { headers: headers() })
      .then(r => r.json())
      .then(data => setCaseUpdates(data.updates || []))
      .catch(() => setCaseUpdates([]));
  }

  const downloadUrl = (studentId, docId) =>
    `${API}/committee/students/${studentId}/documents/${docId}/download?token=${encodeURIComponent(token)}`;

  const previewUrl = (studentId, docId) =>
    `${API}/committee/students/${studentId}/documents/${docId}/preview?token=${encodeURIComponent(token)}`;

  const docLabel = (type) => DOC_LABELS[type || ''] || type || 'Document';

  async function handleSendFeedback(e) {
    e?.preventDefault();
    if (!selected) return;
    const sid = activeTab === 'cases' && selected?.student_id != null ? selected.student_id : selected?.id;
    if (!sid) return;
    if (feedbackFile) {
      setError('');
      setFeedbackUploading(true);
      const form = new FormData();
      form.append('file', feedbackFile);
      form.append('originalName', feedbackFile.name);
      if (feedbackNote.trim()) form.append('description', feedbackNote.trim());
      try {
        const res = await fetch(`${API}/committee/students/${sid}/feedback`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        if (!res.ok) throw new Error('Failed to send');
        setFeedbackFile(null);
        setFeedbackNote('');
        const r = await fetch(`${API}/committee/students/${sid}`, { headers: headers() });
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
        const res = await fetch(`${API}/committee/students/${sid}/clarify`, {
          method: 'POST',
          headers: { ...headers(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: feedbackNote.trim() }),
        });
        if (!res.ok) throw new Error('Failed to send');
        setFeedbackNote('');
        const r = await fetch(`${API}/committee/students/${sid}`, { headers: headers() });
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
      <h2 className={styles.heading}>Committee dashboard</h2>

      {(isAdmin || isExpert) && (
        <div className={styles.tabs}>
          <button
            type="button"
            className={activeTab === 'cases' ? styles.tabActive : styles.tab}
            onClick={() => { setActiveTab('cases'); setSelected(null); }}
          >
            Cases
          </button>
          <button
            type="button"
            className={activeTab === 'students' ? styles.tabActive : styles.tab}
            onClick={() => { setActiveTab('students'); setSelected(null); }}
          >
            Students (upload access)
          </button>
        </div>
      )}

      <p className={styles.hint}>
        {activeTab === 'cases'
          ? 'Click a case to view documents. Admin: assign experts and grant Final Approval - Offered. Expert: Approve or Reject.'
          : 'Click a student to manage their access. Enable/disable upload permissions.'}
      </p>

      {error && <div className={styles.error}>{error}</div>}

      {activeTab === 'students' && students.length > 0 && (
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
          {activeTab === 'cases' ? (
            <ul className={styles.studentList}>
              {cases.length === 0 ? (
                <li className={styles.empty}>No cases yet</li>
              ) : (
                cases.map((c) => (
                  <li key={c.id} className={styles.studentListItem}>
                    <button
                      type="button"
                      className={selected?.id === c.id ? styles.studentBtnActive : styles.studentBtn}
                      onClick={() => setSelected(c)}
                    >
                      <span className={styles.studentEmail}>{c.case_id}</span>
                      <span className={styles.studentMeta}>
                        {c.email} · {c.major || '—'} · {STATUS_LABELS[c.status] || c.status}
                        {c.due_at && new Date(c.due_at) < new Date() && PENDING_STATUSES.includes(c.status) && (
                          <span className={styles.overdueBadge}> Overdue</span>
                        )}
                      </span>
                    </button>
                    {isExpert && (c.status === 'assigned' || c.status === 'under_review' || c.status === 'needs_info' || c.status === 'resubmitted' || c.status === 'overdue') && (
                      <div className={styles.expertQuickActions}>
                        <button
                          type="button"
                          className={styles.approveCaseBtn}
                          onClick={(e) => { e.stopPropagation(); handleApproveCase(c.id); }}
                          disabled={approvingCase === c.id || rejectingCase === c.id}
                          title="Approve"
                        >
                          {approvingCase === c.id ? '…' : '✓'}
                        </button>
                        <button
                          type="button"
                          className={styles.rejectCaseBtnSmall}
                          onClick={(e) => { e.stopPropagation(); handleRejectCase(c.id); }}
                          disabled={approvingCase === c.id || rejectingCase === c.id}
                          title="Reject"
                        >
                          {rejectingCase === c.id ? '…' : '✗'}
                        </button>
                      </div>
                    )}
                  </li>
                ))
              )}
            </ul>
          ) : (
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
          )}
        </aside>
        <section className={styles.detail}>
          {!selected && <p className={styles.placeholder}>Select {activeTab === 'cases' ? 'a case' : 'a student'}</p>}
          {selected && detailLoading && <p className={styles.placeholder}>Loading…</p>}
          {selected && detail && !detailLoading && detail.student && (
            <>
              {detail.hasSubmittedApplication === false && (
                <div className={styles.studentInProgressBanner} role="status">
                  <span className={styles.studentInProgressBadge}>In progress</span>
                  <p className={styles.studentInProgressText}>
                    The student is still working on their application. The application has not been submitted yet.
                  </p>
                </div>
              )}
              {activeTab === 'cases' && selected.case_id && (
                <>
                  <div className={styles.caseBanner}>
                    <span className={styles.caseStageLabel}>Case stage</span>
                    <span className={styles.caseId}>{selected.case_id}</span>
                    <span className={styles.caseStatus}>{STATUS_LABELS[selected.status] || selected.status}</span>
                    {selected.due_at && (
                      <span className={styles.caseDue}>
                        Due: {formatDate(selected.due_at, detail.student?.timezone)}
                        {new Date(selected.due_at) < new Date() && PENDING_STATUSES.includes(selected.status) && (
                          <span className={styles.overdueBadge}>Overdue</span>
                        )}
                      </span>
                    )}
                    {selected.assigned_expert_id && (
                      <span className={styles.caseExpert}>Assigned to: {selected.expert_username || selected.expert_email || 'Expert'}</span>
                    )}
                    {isAdmin && (
                      <select
                        className={styles.statusSelect}
                        value={selected.status}
                        onChange={(e) => handleAdminStatusChange(selected.id, e.target.value)}
                        disabled={updatingStatus === selected.id}
                        title="Admin: Update case status"
                      >
                        <option value="submitted">Submitted</option>
                        <option value="assigned">Assigned</option>
                        <option value="under_review">Under review</option>
                        <option value="needs_info">Needs info</option>
                        <option value="resubmitted">Resubmitted</option>
                        <option value="pending_admin_approval">Pending admin approval</option>
                        <option value="approved">Final Approval - Offered</option>
                        <option value="rejected">Rejected</option>
                        <option value="overdue">Overdue</option>
                      </select>
                    )}
                    {isAdmin && selected.status === 'pending_admin_approval' && (
                      <button
                        type="button"
                        className={styles.finalApproveBtn}
                        onClick={() => handleAdminStatusChange(selected.id, 'approved')}
                        disabled={updatingStatus === selected.id}
                        title="Grant final approval after expert recommendation"
                      >
                        {updatingStatus === selected.id ? 'Saving…' : 'Final Approval - Offered'}
                      </button>
                    )}
                    {isExpert && (selected.status === 'assigned' || selected.status === 'under_review' || selected.status === 'needs_info' || selected.status === 'resubmitted' || selected.status === 'overdue') && (
                      <div className={styles.expertActions}>
                        <button
                          type="button"
                          className={styles.approveCaseBtnDetail}
                          onClick={() => handleApproveCase(selected.id)}
                          disabled={approvingCase === selected.id || rejectingCase === selected.id || updatingStatus === selected.id}
                        >
                          {approvingCase === selected.id ? 'Approving…' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          className={styles.rejectCaseBtn}
                          onClick={() => handleRejectCase(selected.id)}
                          disabled={approvingCase === selected.id || rejectingCase === selected.id || updatingStatus === selected.id}
                        >
                          {rejectingCase === selected.id ? '…' : 'Reject'}
                        </button>
                        <button
                          type="button"
                          className={styles.needsInfoBtn}
                          onClick={() => handleAdminStatusChange(selected.id, 'needs_info')}
                          disabled={approvingCase === selected.id || rejectingCase === selected.id || updatingStatus === selected.id}
                        >
                          {updatingStatus === selected.id ? '…' : 'Needs info'}
                        </button>
                      </div>
                    )}
                  </div>
                  {caseUpdates.length > 0 && (
                    <div className={styles.updatesSection}>
                      <h4 className={styles.updatesTitle}>Status timeline</h4>
                      <ul className={styles.updatesList}>
                        {caseUpdates.map((u, i) => (
                          <li key={i} className={styles.updateItem}>
                            <span className={styles.updateStatus}>{u.from_status || '—'} → {u.to_status}</span>
                            {u.note && <span className={styles.updateNote}>{u.note}</span>}
                            <span className={styles.updateMeta}>
                              {u.changed_by_email} · {formatDate(u.changed_at, detail.student?.timezone)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {isAdmin && selected.status !== 'approved' && selected.status !== 'rejected' && (
                    <div className={styles.assignSection}>
                      <h4 className={styles.assignTitle}>Assign expert</h4>
                      <p className={styles.assignHint}>Recommended experts match the student&apos;s major.</p>
                      <div className={styles.expertGrid}>
                        {expertsForCase?.length ? (
                          <>
                            {(expertsForCase.filter(e => e.recommended) || []).map((ex) => (
                              <button
                                key={ex.id}
                                type="button"
                                className={`${styles.expertCard} ${selected.assigned_expert_id === ex.id ? styles.expertCardActive : ''}`}
                                onClick={() => handleAssignExpert(selected.id, selected.assigned_expert_id === ex.id ? null : ex.id)}
                                disabled={assigningExpert === selected.id}
                              >
                                <span className={styles.expertCardName}>{ex.username || ex.email}</span>
                                {ex.title && <span className={styles.expertCardTitle}>{ex.title}</span>}
                                <span className={styles.expertCardMajor}>{ex.majors?.join(', ') || '—'}</span>
                                {ex.bio && <span className={styles.expertCardBio}>{ex.bio.slice(0, 80)}{ex.bio.length > 80 ? '…' : ''}</span>}
                                <span className={styles.recommendedBadge}>Recommended</span>
                              </button>
                            ))}
                            {(expertsForCase.filter(e => !e.recommended) || []).map((ex) => (
                              <button
                                key={ex.id}
                                type="button"
                                className={`${styles.expertCard} ${selected.assigned_expert_id === ex.id ? styles.expertCardActive : ''}`}
                                onClick={() => handleAssignExpert(selected.id, selected.assigned_expert_id === ex.id ? null : ex.id)}
                                disabled={assigningExpert === selected.id}
                              >
                                <span className={styles.expertCardName}>{ex.username || ex.email}</span>
                                {ex.title && <span className={styles.expertCardTitle}>{ex.title}</span>}
                                <span className={styles.expertCardMajor}>{ex.majors?.join(', ') || '—'}</span>
                                {ex.bio && <span className={styles.expertCardBio}>{ex.bio.slice(0, 80)}{ex.bio.length > 80 ? '…' : ''}</span>}
                              </button>
                            ))}
                            <button
                              type="button"
                              className={`${styles.expertCard} ${!selected.assigned_expert_id ? styles.expertCardActive : ''}`}
                              onClick={() => handleAssignExpert(selected.id, null)}
                              disabled={assigningExpert === selected.id}
                              title="Unassign"
                            >
                              <span className={styles.expertCardName}>Unassign</span>
                            </button>
                          </>
                        ) : (
                          <p className={styles.expertLoading}>{expertsForCase === null ? 'Loading experts…' : 'No experts available'}</p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
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
                  <div className={styles.profileBio}>{detail.student.bio ? detail.student.bio : '—'}</div>
                </div>
              </div>

              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Documents</h4>
                {(() => {
                  const studentDocs = (detail.documents || []).filter(d => !d.uploaded_by);
                  if (!studentDocs.length) return <p className={styles.empty}>No documents uploaded</p>;
                  const byType = {};
                  studentDocs.forEach((d) => {
                    const t = d.type || 'additional';
                    if (!byType[t]) byType[t] = [];
                    byType[t].push(d);
                  });
                  const orderedTypes = [
                    ...DOC_TYPE_ORDER.filter((t) => byType[t]?.length),
                    ...Object.keys(byType).filter((t) => !DOC_TYPE_ORDER.includes(t)),
                  ];
                  return (
                    <div className={styles.docCategoriesTable}>
                      {orderedTypes.map((type) => (
                        <div key={type} className={styles.docCategoryRow}>
                          <div className={styles.docCategoryLabel}>{docLabel(type)}</div>
                          <ul className={styles.docCategoryFileList}>
                            {byType[type].map((doc) => (
                              <li key={doc.id} className={styles.docCategoryFileItem}>
                                <div className={styles.docInfo}>
                                  <div className={styles.docRow}>
                                    <span className={styles.docName}>
                                      {doc.filename}
                                      {doc.version > 1 && <span className={styles.versionBadge}> v{doc.version}</span>}
                                    </span>
                                  </div>
                                  {(doc.type === 'additional' || doc.type === 'feedback') && doc.description && (
                                    <span className={`${styles.docDesc} ${styles.docDescStacked}`}>{doc.description}</span>
                                  )}
                                  {doc.created_at && (
                                    <span className={`${styles.docTime} ${styles.docTimeStacked}`}>Uploaded {formatDate(doc.created_at, detail.student?.timezone)}</span>
                                  )}
                                </div>
                                <div className={styles.docActions}>
                                  <button type="button" className={styles.previewLink} onClick={() => setPreviewDoc({ studentId: detail.student.id, docId: doc.id, filename: doc.filename })}>Preview</button>
                                  <a href={downloadUrl(detail.student.id, doc.id)} target="_blank" rel="noopener noreferrer" className={styles.downloadLink}>Download</a>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
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
                            <div className={styles.docActions}>
                              <button type="button" className={styles.previewLink} onClick={() => setPreviewDoc({ studentId: detail.student.id, docId: doc.id, filename: doc.filename })}>Preview</button>
                              <a href={downloadUrl(detail.student.id, doc.id)} target="_blank" rel="noopener noreferrer" className={styles.downloadLink}>Download</a>
                            </div>
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

        {previewDoc && (
          <div className={styles.previewOverlay} onClick={() => setPreviewDoc(null)} role="dialog" aria-modal="true" aria-label="Document preview">
            <div className={styles.previewModal} onClick={e => e.stopPropagation()}>
              <div className={styles.previewModalHeader}>
                <span className={styles.previewModalTitle}>{previewDoc.filename}</span>
                <button type="button" className={styles.previewModalClose} onClick={() => setPreviewDoc(null)} aria-label="Close">×</button>
              </div>
              <div className={styles.previewModalBody}>
                {/\.pdf$/i.test(previewDoc.filename) ? (
                  <iframe src={previewUrl(previewDoc.studentId, previewDoc.docId)} title={previewDoc.filename} className={styles.previewIframe} />
                ) : /\.txt$/i.test(previewDoc.filename) ? (
                  <iframe src={previewUrl(previewDoc.studentId, previewDoc.docId)} title={previewDoc.filename} className={styles.previewIframe} />
                ) : (
                  <div className={styles.previewFallback}>
                    <p>Preview may not be available for this file type.</p>
                    <a href={previewUrl(previewDoc.studentId, previewDoc.docId)} target="_blank" rel="noopener noreferrer" className={styles.downloadLink}>Open in new tab</a>
                    <a href={downloadUrl(previewDoc.studentId, previewDoc.docId)} target="_blank" rel="noopener noreferrer" className={styles.downloadLink}>Download</a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
