import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../config';
import { formatDate } from '../utils/dateFormat';
import styles from './CommitteeDashboard.module.css';

const DOC_LABELS = {
  sop: 'Statement of Purpose(SOP)',
  lor: 'Letter of recommendation(LOR)',
  resume: 'Resume',
  transcript: 'Transcript',
  additional: 'Additional files',
  feedback: 'Committee feedback',
};
/** Order of document category headings under Documents */
const DOC_TYPE_ORDER = ['sop', 'lor', 'resume', 'transcript', 'additional'];
const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted - Open',
  assigned: 'Assigned',
  under_review: 'Under review',
  needs_info: 'Needs info',
  resubmitted: 'Resubmitted',
  pending_admin_approval: 'Pending admin approval',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  overdue: 'Overdue',
};
const PENDING_STATUSES = ['submitted', 'assigned', 'under_review', 'needs_info', 'resubmitted', 'pending_admin_approval'];
const TERMINAL_CASE_STATUSES = ['approved', 'rejected', 'withdrawn'];
const CASE_EXPERT_UNASSIGNED = '__unassigned__';

function isCasePendingListStatus(status) {
  return status !== 'approved' && status !== 'rejected' && status !== 'withdrawn';
}

/** Local calendar date YYYY-MM-DD for submitted_at or created_at */
function caseListDateKey(c) {
  const iso = c.submitted_at || c.created_at;
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function caseMatchesDateRange(c, fromStr, toStr) {
  if (!fromStr && !toStr) return true;
  const key = caseListDateKey(c);
  if (!key) return false;
  if (fromStr && key < fromStr) return false;
  if (toStr && key > toStr) return false;
  return true;
}

export default function CommitteeDashboard() {
  const { token, user } = useAuth(); // user.id used to label expert’s own assigned cases
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
  /** Admin list filters (Cases + Students tabs) */
  /** all | pending | approved | rejected | withdrawn */
  const [caseStatusFilter, setCaseStatusFilter] = useState('all');
  /** all | __unassigned__ | expert id */
  const [caseExpertFilter, setCaseExpertFilter] = useState('all');
  const [caseDateFrom, setCaseDateFrom] = useState('');
  const [caseDateTo, setCaseDateTo] = useState('');
  const [caseMajorFilter, setCaseMajorFilter] = useState('all');
  const [caseTargetYearFilter, setCaseTargetYearFilter] = useState('all');
  const [studentMajorFilter, setStudentMajorFilter] = useState('all');
  const [studentTargetYearFilter, setStudentTargetYearFilter] = useState('all');
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [expertMajorFilter, setExpertMajorFilter] = useState('all');
  const [expertNameQuery, setExpertNameQuery] = useState('');
  const [expertDetail, setExpertDetail] = useState(null);
  const [expertDetailLoading, setExpertDetailLoading] = useState(false);
  /** Admin: active (non-terminal) cases per expert */
  const [expertWorkload, setExpertWorkload] = useState([]);
  const [workloadExpanded, setWorkloadExpanded] = useState(false);
  const [studentProfileModalOpen, setStudentProfileModalOpen] = useState(false);
  const [privateNotes, setPrivateNotes] = useState([]);
  const [privateNoteText, setPrivateNoteText] = useState('');
  const [privateNotesLoading, setPrivateNotesLoading] = useState(false);
  const [privateNoteSaving, setPrivateNoteSaving] = useState(false);
  const [teamContacts, setTeamContacts] = useState([]);
  const [teamMessages, setTeamMessages] = useState([]);
  const [teamMessagesLoading, setTeamMessagesLoading] = useState(false);
  const [teamMessageText, setTeamMessageText] = useState('');
  const [teamMessageSending, setTeamMessageSending] = useState(false);
  const teamMessageListRef = useRef(null);
  const headers = () => ({ Authorization: `Bearer ${token}` });

  const MAJOR_FILTER_EMPTY = '__empty__';

  const uniqueMajorsFromCases = useMemo(() => {
    const set = new Set();
    let hasNoMajor = false;
    (cases || []).forEach((c) => {
      const m = (c.major || '').trim();
      if (m) set.add(m);
      else hasNoMajor = true;
    });
    const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
    return { majors: sorted, hasNoMajor };
  }, [cases]);

  const uniqueMajorsFromStudents = useMemo(() => {
    const set = new Set();
    let hasNoMajor = false;
    (students || []).forEach((s) => {
      const m = (s.major || '').trim();
      if (m) set.add(m);
      else hasNoMajor = true;
    });
    return { majors: Array.from(set).sort((a, b) => a.localeCompare(b)), hasNoMajor };
  }, [students]);

  const uniqueTargetYears = useMemo(() => {
    const ys = new Set();
    (cases || []).forEach((c) => {
      if (c.target_year != null && !Number.isNaN(Number(c.target_year))) ys.add(Number(c.target_year));
    });
    (students || []).forEach((s) => {
      if (s.target_year != null && !Number.isNaN(Number(s.target_year))) ys.add(Number(s.target_year));
    });
    return Array.from(ys).sort((a, b) => b - a);
  }, [cases, students]);

  function matchesAdminSearchCase(c, q) {
    if (!q) return true;
    const n = q.trim().toLowerCase();
    const fields = [c.email, c.student_username, c.case_id, c.major].filter(Boolean);
    return fields.some((f) => String(f).trim().toLowerCase().includes(n));
  }

  function matchesAdminSearchStudent(s, q) {
    if (!q) return true;
    const n = q.trim().toLowerCase();
    const fields = [s.email, s.username, s.major].filter(Boolean);
    return fields.some((f) => String(f).trim().toLowerCase().includes(n));
  }

  const expertsSortedForFilter = useMemo(() => {
    return [...(experts || [])].sort((a, b) => {
      const an = (a.username || a.email || '').toLowerCase();
      const bn = (b.username || b.email || '').toLowerCase();
      return an.localeCompare(bn);
    });
  }, [experts]);

  const filteredCases = useMemo(() => {
    if (!isAdmin) return cases;
    const q = adminSearchQuery.trim();
    return (cases || []).filter((c) => {
      if (!matchesAdminSearchCase(c, q)) return false;
      if (caseStatusFilter === 'pending' && !isCasePendingListStatus(c.status)) return false;
      if (caseStatusFilter === 'approved' && c.status !== 'approved') return false;
      if (caseStatusFilter === 'rejected' && c.status !== 'rejected') return false;
      if (caseStatusFilter === 'withdrawn' && c.status !== 'withdrawn') return false;
      if (caseExpertFilter === CASE_EXPERT_UNASSIGNED) {
        if (c.assigned_expert_id != null && c.assigned_expert_id !== '') return false;
      } else if (caseExpertFilter !== 'all') {
        const want = Number(caseExpertFilter);
        if (Number(c.assigned_expert_id) !== want) return false;
      }
      if (!caseMatchesDateRange(c, caseDateFrom, caseDateTo)) return false;
      if (caseMajorFilter !== 'all') {
        const m = (c.major || '').trim();
        if (caseMajorFilter === MAJOR_FILTER_EMPTY) {
          if (m) return false;
        } else if (m !== caseMajorFilter) return false;
      }
      if (caseTargetYearFilter !== 'all') {
        const y = c.target_year != null ? Number(c.target_year) : null;
        if (y !== Number(caseTargetYearFilter)) return false;
      }
      return true;
    });
  }, [
    cases,
    isAdmin,
    caseStatusFilter,
    caseExpertFilter,
    caseDateFrom,
    caseDateTo,
    caseMajorFilter,
    caseTargetYearFilter,
    adminSearchQuery,
  ]);

  const filteredStudents = useMemo(() => {
    if (!isAdmin) return students;
    const q = adminSearchQuery.trim();
    return (students || []).filter((s) => {
      if (!matchesAdminSearchStudent(s, q)) return false;
      if (studentMajorFilter !== 'all') {
        const m = (s.major || '').trim();
        if (studentMajorFilter === MAJOR_FILTER_EMPTY) {
          if (m) return false;
        } else if (m !== studentMajorFilter) return false;
      }
      if (studentTargetYearFilter !== 'all') {
        const y = s.target_year != null ? Number(s.target_year) : null;
        if (y !== Number(studentTargetYearFilter)) return false;
      }
      return true;
    });
  }, [students, isAdmin, studentMajorFilter, studentTargetYearFilter, adminSearchQuery]);

  const uniqueMajorsFromExperts = useMemo(() => {
    const set = new Set();
    let hasNoMajor = false;
    (experts || []).forEach((ex) => {
      const list = Array.isArray(ex.majors) ? ex.majors : [];
      if (list.length === 0) hasNoMajor = true;
      list.forEach((m) => {
        const t = (m || '').trim();
        if (t) set.add(t);
      });
    });
    return { majors: Array.from(set).sort((a, b) => a.localeCompare(b)), hasNoMajor };
  }, [experts]);

  const filteredExperts = useMemo(() => {
    if (!isAdmin) return experts;
    const q = expertNameQuery.trim().toLowerCase();
    return (experts || []).filter((ex) => {
      if (q) {
        const hay = [ex.email, ex.username, ex.title].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (expertMajorFilter === 'all') return true;
      const list = Array.isArray(ex.majors) ? ex.majors.map((m) => (m || '').trim()).filter(Boolean) : [];
      if (expertMajorFilter === MAJOR_FILTER_EMPTY) return list.length === 0;
      return list.includes(expertMajorFilter);
    });
  }, [experts, isAdmin, expertMajorFilter, expertNameQuery]);

  const workloadByExpertId = useMemo(() => {
    const m = {};
    (expertWorkload || []).forEach((w) => {
      m[w.expert_id] = w.active_case_count;
    });
    return m;
  }, [expertWorkload]);

  const teamTotalUnread = useMemo(
    () => (teamContacts || []).reduce((sum, c) => sum + Number(c.unread_count || 0), 0),
    [teamContacts],
  );

  const selectedStudentSummary = useMemo(() => {
    if (!selected || activeTab === 'experts') return null;
    if (activeTab === 'cases') {
      return {
        username: selected.student_username || detail?.student?.username || '',
        email: selected.email || detail?.student?.email || '',
        major: selected.major || detail?.student?.major || '',
      };
    }
    return {
      username: selected.username || detail?.student?.username || '',
      email: selected.email || detail?.student?.email || '',
      major: selected.major || detail?.student?.major || '',
    };
  }, [selected, activeTab, detail]);

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

  function loadExpertWorkload() {
    if (!isAdmin) return;
    fetch(`${API}/cases/experts/workload`, { headers: headers() })
      .then((r) => r.json())
      .then((data) => setExpertWorkload(data.workload || []))
      .catch(() => setExpertWorkload([]));
  }

  function loadStudents() {
    fetch(`${API}/committee/students`, { headers: headers() })
      .then(r => r.json())
      .then(data => setStudents(data.students || []));
  }

  function loadTeamContacts() {
    fetch(`${API}/committee/team/contacts`, { headers: headers() })
      .then((r) => r.json())
      .then((data) => setTeamContacts(data.contacts || []))
      .catch(() => setTeamContacts([]));
  }

  function loadTeamMessages(otherUserId) {
    if (!otherUserId) {
      setTeamMessages([]);
      return;
    }
    setTeamMessagesLoading(true);
    fetch(`${API}/committee/team/messages/${otherUserId}`, { headers: headers() })
      .then((r) => {
        if (!r.ok) throw new Error('Failed');
        return r.json();
      })
      .then((data) => setTeamMessages(data.messages || []))
      .catch(() => setTeamMessages([]))
      .finally(() => {
        setTeamMessagesLoading(false);
        loadTeamContacts();
      });
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
    : activeTab === 'students'
      ? selected?.id
      : null;

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
    if (activeTab !== 'cases' || !selected?.id) return;
    const list = isAdmin ? filteredCases : cases;
    if (!list.some((c) => c.id === selected.id)) setSelected(null);
  }, [activeTab, selected?.id, isAdmin, filteredCases, cases]);

  useEffect(() => {
    if (activeTab !== 'students' || !selected?.id) return;
    const list = isAdmin ? filteredStudents : students;
    if (!list.some((s) => s.id === selected.id)) setSelected(null);
  }, [activeTab, selected?.id, isAdmin, filteredStudents, students]);

  useEffect(() => {
    if (activeTab !== 'experts' || !selected?.id) return;
    if (!filteredExperts.some((e) => e.id === selected.id)) setSelected(null);
  }, [activeTab, selected?.id, filteredExperts]);

  useEffect(() => {
    if (activeTab !== 'experts' || !selected?.id) {
      setExpertDetail(null);
      return;
    }
    let cancelled = false;
    setExpertDetailLoading(true);
    setError('');
    fetch(`${API}/cases/experts/${selected.id}`, { headers: headers() })
      .then((r) => {
        if (!r.ok) throw new Error('Failed');
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setExpertDetail(data);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load expert');
          setExpertDetail(null);
        }
      })
      .finally(() => {
        if (!cancelled) setExpertDetailLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeTab, selected?.id, token]);

  useEffect(() => {
    if (activeTab === 'cases' && selected?.id) {
      loadCaseUpdates(selected.id);
      loadPrivateNotes(selected.id);
    } else {
      setCaseUpdates([]);
      setPrivateNotes([]);
      setPrivateNoteText('');
    }
  }, [activeTab, selected?.id]);

  useEffect(() => {
    if (activeTab === 'team') {
      loadTeamContacts();
    }
  }, [activeTab, token]);

  useEffect(() => {
    if (activeTab !== 'team') return undefined;
    const intervalId = setInterval(() => loadTeamContacts(), 12000);
    return () => clearInterval(intervalId);
  }, [activeTab, token]);

  useEffect(() => {
    if (activeTab === 'team' && selected?.id) {
      loadTeamMessages(selected.id);
    } else if (activeTab !== 'team') {
      setTeamMessages([]);
      setTeamMessageText('');
    }
  }, [activeTab, selected?.id]);

  useEffect(() => {
    if (activeTab !== 'team' || teamMessagesLoading) return;
    const el = teamMessageListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeTab, teamMessages, teamMessagesLoading]);

  useEffect(() => {
    if (isAdmin) loadExpertWorkload();
  }, [isAdmin, token]);

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
      loadExpertWorkload();
    }
  }

  async function handleApproveCase(caseId) {
    setError('');
    setApprovingCase(caseId);
    try {
      const res = await fetch(`${API}/cases/${caseId}/approve`, { method: 'PATCH', headers: headers() });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
      loadCases();
      loadExpertWorkload();
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
      loadExpertWorkload();
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
      loadExpertWorkload();
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

  function loadPrivateNotes(caseId) {
    if (!caseId) return;
    setPrivateNotesLoading(true);
    fetch(`${API}/cases/${caseId}/private-notes`, { headers: headers() })
      .then((r) => {
        if (!r.ok) throw new Error('Failed');
        return r.json();
      })
      .then((data) => setPrivateNotes(data.notes || []))
      .catch(() => setPrivateNotes([]))
      .finally(() => setPrivateNotesLoading(false));
  }

  async function submitPrivateNote(caseId) {
    if (!caseId || !privateNoteText.trim()) return;
    setPrivateNoteSaving(true);
    setError('');
    try {
      const res = await fetch(`${API}/cases/${caseId}/private-notes`, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: privateNoteText.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save note');
      setPrivateNoteText('');
      loadPrivateNotes(caseId);
    } catch (e) {
      setError(e.message || 'Failed to save note');
    } finally {
      setPrivateNoteSaving(false);
    }
  }

  async function sendTeamMessage() {
    if (!selected?.id || !teamMessageText.trim()) return;
    setTeamMessageSending(true);
    setError('');
    try {
      const res = await fetch(`${API}/committee/team/messages/${selected.id}`, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: teamMessageText.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      setTeamMessageText('');
      loadTeamMessages(selected.id);
    } catch (e) {
      setError(e.message || 'Failed to send message');
    } finally {
      setTeamMessageSending(false);
    }
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
          {isAdmin && (
            <button
              type="button"
              className={activeTab === 'experts' ? styles.tabActive : styles.tab}
              onClick={() => { setActiveTab('experts'); setSelected(null); }}
            >
              Experts
            </button>
          )}
          <button
            type="button"
            className={activeTab === 'team' ? styles.tabActive : styles.tab}
            onClick={() => { setActiveTab('team'); setSelected(null); }}
          >
            <span className={styles.tabLabelWithBadge}>
              Team Messages
              {teamTotalUnread > 0 && (
                <span className={styles.teamTabUnreadBadge} title="Unread direct messages">
                  {teamTotalUnread > 99 ? '99+' : teamTotalUnread}
                </span>
              )}
            </span>
          </button>
        </div>
      )}

      {isAdmin && activeTab !== 'experts' && activeTab !== 'team' && (
        <div className={styles.adminToolbar}>
          <label className={styles.adminSearchField}>
            <span className={styles.filterFieldLabel}>Search</span>
            <input
              type="search"
              className={styles.adminSearchInput}
              value={adminSearchQuery}
              onChange={(e) => setAdminSearchQuery(e.target.value)}
              placeholder={activeTab === 'cases' ? 'Student name, email, case ID…' : 'Student name or email…'}
              aria-label="Search by student name, email, or case ID"
            />
          </label>
          {activeTab === 'cases' && (
            <div className={styles.caseFilters}>
              <label className={styles.filterField}>
                <span className={styles.filterFieldLabel}>Status</span>
                <select
                  className={styles.filterSelect}
                  value={caseStatusFilter}
                  onChange={(e) => setCaseStatusFilter(e.target.value)}
                  aria-label="Filter cases by workflow status"
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending (open)</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </label>
              <label className={styles.filterField}>
                <span className={styles.filterFieldLabel}>Expert</span>
                <select
                  className={styles.filterSelect}
                  value={caseExpertFilter}
                  onChange={(e) => setCaseExpertFilter(e.target.value)}
                  aria-label="Filter cases by assigned expert"
                >
                  <option value="all">All experts</option>
                  <option value={CASE_EXPERT_UNASSIGNED}>Unassigned</option>
                  {expertsSortedForFilter.map((ex) => (
                    <option key={ex.id} value={String(ex.id)}>
                      {ex.username || ex.email || `Expert ${ex.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.filterField}>
                <span className={styles.filterFieldLabel}>Submitted from</span>
                <input
                  type="date"
                  className={styles.filterDateInput}
                  value={caseDateFrom}
                  onChange={(e) => setCaseDateFrom(e.target.value)}
                  aria-label="Filter cases submitted on or after this date"
                />
              </label>
              <label className={styles.filterField}>
                <span className={styles.filterFieldLabel}>Submitted to</span>
                <input
                  type="date"
                  className={styles.filterDateInput}
                  value={caseDateTo}
                  onChange={(e) => setCaseDateTo(e.target.value)}
                  aria-label="Filter cases submitted on or before this date"
                />
              </label>
              <label className={styles.filterField}>
                <span className={styles.filterFieldLabel}>Major</span>
                <select
                  className={styles.filterSelect}
                  value={caseMajorFilter}
                  onChange={(e) => setCaseMajorFilter(e.target.value)}
                  aria-label="Filter cases by student major"
                >
                  <option value="all">All majors</option>
                  {uniqueMajorsFromCases.hasNoMajor && (
                    <option value={MAJOR_FILTER_EMPTY}>No major listed</option>
                  )}
                  {uniqueMajorsFromCases.majors.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label className={styles.filterField}>
                <span className={styles.filterFieldLabel}>Target year</span>
                <select
                  className={styles.filterSelect}
                  value={caseTargetYearFilter}
                  onChange={(e) => setCaseTargetYearFilter(e.target.value)}
                  aria-label="Filter cases by target year from case ID"
                >
                  <option value="all">All years</option>
                  {uniqueTargetYears.map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {activeTab === 'students' && (
            <div className={styles.caseFilters}>
              <label className={styles.filterField}>
                <span className={styles.filterFieldLabel}>Major</span>
                <select
                  className={styles.filterSelect}
                  value={studentMajorFilter}
                  onChange={(e) => setStudentMajorFilter(e.target.value)}
                  aria-label="Filter students by major"
                >
                  <option value="all">All majors</option>
                  {uniqueMajorsFromStudents.hasNoMajor && (
                    <option value={MAJOR_FILTER_EMPTY}>No major listed</option>
                  )}
                  {uniqueMajorsFromStudents.majors.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label className={styles.filterField}>
                <span className={styles.filterFieldLabel}>Target year</span>
                <select
                  className={styles.filterSelect}
                  value={studentTargetYearFilter}
                  onChange={(e) => setStudentTargetYearFilter(e.target.value)}
                  aria-label="Filter students by target year from latest case ID"
                >
                  <option value="all">All years</option>
                  {uniqueTargetYears.map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
      )}

      {isAdmin && activeTab === 'experts' && (
        <div className={styles.adminToolbar}>
          <label className={styles.adminSearchField}>
            <span className={styles.filterFieldLabel}>Name</span>
            <input
              type="search"
              className={styles.adminSearchInput}
              value={expertNameQuery}
              onChange={(e) => setExpertNameQuery(e.target.value)}
              placeholder="Expert name, email, or title…"
              aria-label="Search experts by name or email"
            />
          </label>
          <div className={styles.caseFilters}>
            <label className={styles.filterField}>
              <span className={styles.filterFieldLabel}>Major</span>
              <select
                className={styles.filterSelect}
                value={expertMajorFilter}
                onChange={(e) => setExpertMajorFilter(e.target.value)}
                aria-label="Filter experts by major"
              >
                <option value="all">All majors</option>
                {uniqueMajorsFromExperts.hasNoMajor && (
                  <option value={MAJOR_FILTER_EMPTY}>No majors listed</option>
                )}
                {uniqueMajorsFromExperts.majors.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {isAdmin && activeTab === 'experts' && (
        <div className={styles.workloadPanel} role="region" aria-label="Expert workload">
          <div className={styles.workloadHeader}>
            <h3 className={styles.workloadTitle}>Expert workload</h3>
            <button
              type="button"
              className={styles.workloadToggleBtn}
              onClick={() => setWorkloadExpanded((prev) => !prev)}
              aria-expanded={workloadExpanded}
            >
              {workloadExpanded ? 'Hide' : 'Expert Workload'}
            </button>
          </div>
          <p className={styles.workloadHint}>
            Active cases are assigned applications not yet approved, rejected, or withdrawn. Use this table to spread work across experts.
          </p>
          {workloadExpanded && (
            expertWorkload.length === 0 ? (
              <p className={styles.workloadEmpty}>No experts or no workload data yet.</p>
            ) : (
              <div className={styles.workloadTableWrap}>
                <table className={styles.workloadTable}>
                  <thead>
                    <tr>
                      <th scope="col">Expert</th>
                      <th scope="col">Email</th>
                      <th scope="col">Active cases</th>
                      <th scope="col">Completed cases</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expertWorkload.map((w) => (
                      <tr key={w.expert_id}>
                        <td>{w.username || '—'}</td>
                        <td>{w.email || '—'}</td>
                        <td>{w.active_case_count}</td>
                        <td>{w.completed_case_count ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}

      <p className={styles.hint}>
        {activeTab === 'cases'
          ? (isAdmin
            ? 'Use search and filters, then click a case. Assign experts and grant Final Approval where appropriate.'
            : 'Click a case to view documents. Approve or Reject when assigned.')
          : activeTab === 'experts'
            ? 'Filter by major and name, then click an expert to view their profile and assigned cases (active and completed).'
          : activeTab === 'team'
            ? 'Select a teammate and send direct internal messages (admin and experts only).'
          : (isAdmin
            ? 'Use search and filters, then click a student to manage upload access.'
            : 'Click a student to manage upload access. Experts and admins can enable or disable uploads (not for students with a final-approved case until an admin reopens the case).')}
      </p>

      {error && <div className={styles.error}>{error}</div>}

      {activeTab === 'students' && isAdmin && students.length > 0 && (
        <div className={styles.bulkActions}>
          <button type="button" className={styles.enableAllBtn} onClick={enableAll} disabled={enablingAll || disablingAll}>
            {enablingAll ? 'Enabling…' : 'Enable upload for all'}
          </button>
          <button type="button" className={styles.disableAllBtn} onClick={disableAll} disabled={enablingAll || disablingAll}>
            {disablingAll ? 'Disabling…' : 'Disable upload for all'}
          </button>
        </div>
      )}

      <div className={`${styles.grid} ${!isExpert || activeTab === 'experts' || activeTab === 'team' ? styles.gridTwoCol : ''}`}>
        <aside className={styles.sidebar}>
          {activeTab === 'cases' ? (
            <>
            <ul className={styles.studentList}>
              {filteredCases.length === 0 ? (
                <li className={styles.empty}>{cases.length === 0 ? 'No cases yet' : 'No cases match your filters or search'}</li>
              ) : (
                filteredCases.map((c) => (
                  <li key={c.id} className={styles.studentListItem}>
                    <button
                      type="button"
                      className={selected?.id === c.id ? styles.studentBtnActive : styles.studentBtn}
                      onClick={() => setSelected(c)}
                    >
                      <span className={styles.studentEmail}>{c.case_id}</span>
                      <span className={styles.studentMeta}>
                        {[c.student_username, c.email].filter(Boolean).join(' · ')} · {c.major || '—'} · {STATUS_LABELS[c.status] || c.status}
                        {c.due_at && new Date(c.due_at) < new Date() && PENDING_STATUSES.includes(c.status) && (
                          <span className={styles.overdueBadge}> Overdue</span>
                        )}
                      </span>
                      {isAdmin && c.status === 'approved' && (c.expert_email || c.expert_username) && (
                        <span className={styles.caseHandledByProminent}>
                          <span className={styles.caseHandledByLabel}>Handled by</span>
                          <span className={styles.caseHandledByExpert}>{c.expert_username || 'Expert'}</span>
                          <span className={styles.caseHandledByEmail}>{c.expert_email || '—'}</span>
                        </span>
                      )}
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
            </>
          ) : activeTab === 'experts' ? (
            <ul className={styles.studentList}>
              {filteredExperts.length === 0 ? (
                <li className={styles.empty}>
                  {experts.length === 0 ? 'No experts yet' : 'No experts match your filters or search'}
                </li>
              ) : (
                filteredExperts.map((ex) => (
                  <li key={ex.id} className={styles.studentListItem}>
                    <button
                      type="button"
                      className={selected?.id === ex.id ? styles.studentBtnActive : styles.studentBtn}
                      onClick={() => setSelected(ex)}
                    >
                      <span className={styles.studentEmail}>{ex.username || ex.email}</span>
                      <span className={styles.studentMeta}>
                        {ex.email && ex.username ? `${ex.email} · ` : ''}
                        {(ex.majors && ex.majors.length) ? ex.majors.join(', ') : 'No majors listed'}
                        {workloadByExpertId[ex.id] != null && (
                          <>
                            {' · '}
                            <span className={styles.activeCaseCount}>
                              {workloadByExpertId[ex.id]} active {workloadByExpertId[ex.id] === 1 ? 'case' : 'cases'}
                            </span>
                          </>
                        )}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : activeTab === 'team' ? (
            <ul className={styles.studentList}>
              {teamContacts.length === 0 ? (
                <li className={styles.empty}>No teammates available</li>
              ) : (
                teamContacts.map((t) => {
                  const unread = Number(t.unread_count) || 0;
                  return (
                  <li key={t.id} className={styles.studentListItem}>
                    <button
                      type="button"
                      className={`${selected?.id === t.id ? styles.studentBtnActive : styles.studentBtn} ${unread > 0 ? styles.teamContactHasUnread : ''}`}
                      onClick={() => setSelected(t)}
                    >
                      <span className={styles.teamContactTopRow}>
                        <span className={styles.studentEmail}>{t.username || t.email}</span>
                        {unread > 0 && (
                          <span className={styles.teamUnreadBadge} aria-label={`${unread} unread messages`}>
                            {unread > 99 ? '99+' : unread}
                          </span>
                        )}
                      </span>
                      <span className={styles.studentMeta}>
                        {t.email} · {t.role === 'admin' ? 'Admin' : 'Expert'}
                      </span>
                    </button>
                  </li>
                  );
                })
              )}
            </ul>
          ) : (
            <ul className={styles.studentList}>
              {(isAdmin ? filteredStudents : students).length === 0 ? (
                <li className={styles.empty}>
                  {students.length === 0 ? 'No students yet' : 'No students match your filters or search'}
                </li>
              ) : (
                (isAdmin ? filteredStudents : students).map((s) => {
                  const approvedCaseLocked = !!s.has_approved_case;
                  return (
                  <li key={s.id} className={`${styles.studentListItem} ${isExpert && approvedCaseLocked ? styles.studentListItemGrey : ''}`}>
                    <button
                      type="button"
                      className={selected?.id === s.id ? styles.studentBtnActive : styles.studentBtn}
                      onClick={() => setSelected(s)}
                    >
                      <span className={styles.studentEmail}>{[s.username, s.email].filter(Boolean).join(' · ') || s.email}</span>
                      <span className={styles.studentMeta}>
                        {s.major || 'No major'}
                        {s.target_year != null && !Number.isNaN(Number(s.target_year)) && (
                          <> · Target year {Number(s.target_year)}</>
                        )}
                        {' · '}{s.approved ? '✓' : '–'} · {s.doc_count} doc{s.doc_count !== 1 ? 's' : ''}
                        {approvedCaseLocked && <span className={styles.approvedCaseBadge}> Final approval</span>}
                      </span>
                    </button>
                    {(isAdmin || isExpert) && (
                      <button
                        type="button"
                        className={s.approved ? styles.approveBtnOn : styles.approveBtn}
                        onClick={(e) => { e.stopPropagation(); toggleApproval(s.id); }}
                        disabled={isExpert && approvedCaseLocked}
                        title={
                          isExpert && approvedCaseLocked
                            ? 'Cannot change while the case is final-approved (admin must reopen)'
                            : (s.approved ? 'Disable upload for student' : 'Enable upload for student')
                        }
                      >
                        {s.approved ? 'Disable upload' : 'Enable upload'}
                      </button>
                    )}
                  </li>
                  );
                })
              )}
            </ul>
          )}
        </aside>
        <section className={styles.detail}>
          {!selected && (
            <p className={styles.placeholder}>
              Select {activeTab === 'cases' ? 'a case' : activeTab === 'experts' ? 'an expert' : activeTab === 'team' ? 'a teammate' : 'a student'}
            </p>
          )}
          {activeTab === 'team' && selected && (
            <div className={styles.teamMessagePanel}>
              <div className={styles.teamMessageHeader}>
                <h3 className={styles.detailTitle}>{selected.username || selected.email}</h3>
                <span className={styles.teamMessageMeta}>
                  {selected.email} · {selected.role === 'admin' ? 'Admin' : 'Expert'}
                </span>
              </div>
              <div ref={teamMessageListRef} className={styles.teamMessageList}>
                {teamMessagesLoading ? (
                  <p className={styles.empty}>Loading messages…</p>
                ) : teamMessages.length === 0 ? (
                  <p className={styles.empty}>No messages yet</p>
                ) : (
                  teamMessages.map((m) => {
                    const isMine = m.sender_id === user?.id;
                    return (
                      <div key={m.id} className={isMine ? styles.teamMessageItemMine : styles.teamMessageItem}>
                        <p className={styles.teamMessageText}>{m.message}</p>
                        <p className={styles.teamMessageItemMeta}>
                          {isMine ? 'You' : (m.sender_username || m.sender_email || 'Teammate')} · {formatDate(m.created_at, user?.timezone)}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
              <div className={styles.teamMessageComposer}>
                <textarea
                  className={styles.clarifyTextarea}
                  rows={3}
                  maxLength={2000}
                  placeholder="Write a message to your teammate..."
                  value={teamMessageText}
                  onChange={(e) => setTeamMessageText(e.target.value)}
                  disabled={teamMessageSending}
                />
                <button
                  type="button"
                  className={styles.addTypeBtn}
                  disabled={!teamMessageText.trim() || teamMessageSending}
                  onClick={sendTeamMessage}
                >
                  {teamMessageSending ? 'Sending…' : 'Send Message'}
                </button>
              </div>
            </div>
          )}
          {activeTab === 'experts' && selected && expertDetailLoading && <p className={styles.placeholder}>Loading…</p>}
          {activeTab === 'experts' && selected && !expertDetailLoading && expertDetail?.expert && (
            <>
              <div className={styles.detailHeader}>
                <h3 className={styles.detailTitle}>Profile</h3>
              </div>
              <div className={styles.profilePanel}>
                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>Name</span>
                  <span className={styles.profileValue}>{expertDetail.expert.username || '—'}</span>
                </div>
                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>Email</span>
                  <span className={styles.profileValue}>
                    {expertDetail.expert.email ? (
                      <a href={`mailto:${expertDetail.expert.email}`} className={styles.handledCasePanelEmail}>
                        {expertDetail.expert.email}
                      </a>
                    ) : '—'}
                  </span>
                </div>
                {expertDetail.expert.title && (
                  <div className={styles.profileRow}>
                    <span className={styles.profileLabel}>Title</span>
                    <span className={styles.profileValue}>{expertDetail.expert.title}</span>
                  </div>
                )}
                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>Majors</span>
                  <span className={styles.profileValue}>
                    {expertDetail.expert.majors?.length ? (
                      <span className={styles.profileTagsWrap}>
                        {expertDetail.expert.majors.map((m) => (
                          <span key={m} className={styles.profileTag}>{m}</span>
                        ))}
                      </span>
                    ) : '—'}
                  </span>
                </div>
                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>Bio</span>
                  <div className={styles.profileBio}>{expertDetail.expert.bio ? expertDetail.expert.bio : '—'}</div>
                </div>
              </div>

              {(() => {
                const all = expertDetail.cases || [];
                const activeCases = all.filter((c) => !TERMINAL_CASE_STATUSES.includes(c.status));
                const handledCases = all.filter((c) => TERMINAL_CASE_STATUSES.includes(c.status));
                const renderCaseRow = (c) => (
                  <li key={c.id} className={styles.expertCaseRow}>
                    <span className={styles.expertCaseId}>{c.case_id}</span>
                    <span className={styles.expertCaseMeta}>
                      {[c.student_username, c.email].filter(Boolean).join(' · ') || c.email}
                      {c.major ? ` · ${c.major}` : ''}
                    </span>
                    <span className={styles.expertCaseStatus}>{STATUS_LABELS[c.status] || c.status}</span>
                  </li>
                );
                return (
                  <>
                    <div className={styles.section}>
                      <h4 className={styles.sectionTitle}>Cases in progress</h4>
                      {activeCases.length === 0 ? (
                        <p className={styles.empty}>No active assigned cases</p>
                      ) : (
                        <ul className={styles.expertCaseList}>{activeCases.map(renderCaseRow)}</ul>
                      )}
                    </div>
                    <div className={styles.section}>
                      <h4 className={styles.sectionTitle}>Cases handled (completed)</h4>
                      {handledCases.length === 0 ? (
                        <p className={styles.empty}>No completed cases yet</p>
                      ) : (
                        <ul className={styles.expertCaseList}>{handledCases.map(renderCaseRow)}</ul>
                      )}
                    </div>
                  </>
                );
              })()}
            </>
          )}
          {selected && detailLoading && activeTab !== 'experts' && activeTab !== 'team' && <p className={styles.placeholder}>Loading…</p>}
          {selected && detail && !detailLoading && detail.student && activeTab !== 'experts' && activeTab !== 'team' && (
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
                  {isAdmin && selected.status === 'approved' && selected.assigned_expert_id && (
                    <div className={styles.handledCasePanel} role="region" aria-label="Handling Expert Details">
                      <div className={styles.handledCasePanelHeader}>Handling Expert Details</div>
                      <div className={styles.handledCasePanelBody}>
                        <div className={styles.handledCasePanelName}>{selected.expert_username || selected.expert_email || 'Expert'}</div>
                        {selected.expert_email && (
                          <a className={styles.handledCasePanelEmail} href={`mailto:${selected.expert_email}`}>
                            {selected.expert_email}
                          </a>
                        )}
                      </div>
                    </div>
                  )}
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
                    {selected.assigned_expert_id && !(isAdmin && selected.status === 'approved') && (
                      <span className={styles.caseExpert}>
                        {isExpert && selected.assigned_expert_id === user?.id
                          ? (selected.status === 'approved' ? 'You handled this case' : 'You are assigned to this case')
                          : (
                            <>
                              {selected.status === 'approved' ? 'Handled by' : 'Assigned to'}: {selected.expert_username || selected.expert_email || 'Expert'}
                              {selected.expert_email ? ` · ${selected.expert_email}` : ''}
                            </>
                          )}
                      </span>
                    )}
                    {isAdmin && (
                      <select
                        className={styles.statusSelect}
                        value={selected.status}
                        onChange={(e) => handleAdminStatusChange(selected.id, e.target.value)}
                        disabled={updatingStatus === selected.id}
                        title="Admin: Update case status"
                      >
                        <option value="submitted">Submitted - Open</option>
                        <option value="assigned">Assigned</option>
                        <option value="under_review">Under review</option>
                        <option value="needs_info">Needs info</option>
                        <option value="resubmitted">Resubmitted</option>
                        <option value="pending_admin_approval">Pending admin approval</option>
                        <option value="approved">Final Approval - Offered</option>
                        <option value="rejected">Rejected</option>
                        <option value="withdrawn">Withdrawn</option>
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
                        {(selected.status === 'assigned' || selected.status === 'resubmitted' || selected.status === 'overdue') && (
                          <button
                            type="button"
                            className={styles.startReviewBtn}
                            onClick={() => handleAdminStatusChange(selected.id, 'under_review')}
                            disabled={
                              updatingStatus === selected.id ||
                              approvingCase === selected.id ||
                              rejectingCase === selected.id
                            }
                            title="Mark that you have begun reviewing so the student sees Under review"
                          >
                            {updatingStatus === selected.id ? 'Updating…' : 'Start review'}
                          </button>
                        )}
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
                  {isAdmin && selected.status !== 'approved' && selected.status !== 'rejected' && selected.status !== 'withdrawn' && (
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
                                {workloadByExpertId[ex.id] != null && (
                                  <span className={styles.expertCardWorkload}>
                                    {workloadByExpertId[ex.id]} active {workloadByExpertId[ex.id] === 1 ? 'case' : 'cases'}
                                  </span>
                                )}
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
                                {workloadByExpertId[ex.id] != null && (
                                  <span className={styles.expertCardWorkload}>
                                    {workloadByExpertId[ex.id]} active {workloadByExpertId[ex.id] === 1 ? 'case' : 'cases'}
                                  </span>
                                )}
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
                <div className={styles.detailHeaderActions}>
                  <button
                    type="button"
                    className={styles.profileActionBtn}
                    onClick={() => setStudentProfileModalOpen(true)}
                    disabled={!detail?.student}
                    title="Open full student profile"
                  >
                    Profile
                  </button>
                  {(isAdmin || isExpert) && (
                    <button
                      type="button"
                      className={detail.student.approved ? styles.approveBtnOn : styles.approveBtn}
                      onClick={() => toggleApproval(detail.student.id)}
                      disabled={isExpert && detail.student.hasApprovedCase}
                      title={
                        isExpert && detail.student.hasApprovedCase
                          ? 'Cannot change while the case is final-approved (admin must reopen)'
                          : undefined
                      }
                    >
                      {detail.student.approved ? 'Disable upload' : 'Enable upload'}
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.profilePanel}>
                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>Name</span>
                  <span className={styles.profileValue}>{detail.student.username || selectedStudentSummary?.username || '—'}</span>
                </div>
                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>Email</span>
                  <span className={styles.profileValueMuted}>{detail.student.email || selectedStudentSummary?.email || '—'}</span>
                </div>
                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>Major</span>
                  <span className={styles.profileValue}>{detail.student.major ? <span className={styles.profileTag}>{detail.student.major}</span> : '—'}</span>
                </div>
                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>Target year</span>
                  <span className={styles.profileValue}>
                    {detail.student.target_year != null && !Number.isNaN(Number(detail.student.target_year))
                      ? Number(detail.student.target_year)
                      : '—'}
                  </span>
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

              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Private Case Notes</h4>
                <p className={styles.extraHint}>Internal notes only. Students cannot view this section.</p>
                {privateNotesLoading ? (
                  <p className={styles.empty}>Loading notes…</p>
                ) : privateNotes.length === 0 ? (
                  <p className={styles.empty}>No private notes yet</p>
                ) : (
                  <div className={styles.privateNotesList}>
                    {privateNotes.map((n) => (
                      <div key={n.id} className={styles.privateNoteItem}>
                        <p className={styles.privateNoteText}>{n.note}</p>
                        <p className={styles.privateNoteMeta}>
                          {n.from_email || 'Unknown'} · {formatDate(n.created_at, detail.student?.timezone)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <div className={styles.privateNoteComposer}>
                  <textarea
                    placeholder="Add internal evaluation notes for expert/admin collaboration..."
                    value={privateNoteText}
                    onChange={(e) => setPrivateNoteText(e.target.value)}
                    className={styles.clarifyTextarea}
                    rows={3}
                    disabled={privateNoteSaving}
                    maxLength={2000}
                  />
                  <button
                    type="button"
                    onClick={() => submitPrivateNote(selected.id)}
                    className={styles.addTypeBtn}
                    disabled={!privateNoteText.trim() || privateNoteSaving}
                  >
                    {privateNoteSaving ? 'Saving…' : 'Save Note'}
                  </button>
                </div>
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

        {studentProfileModalOpen && detail?.student && activeTab !== 'experts' && (
          <div
            className={styles.studentProfileOverlay}
            onClick={() => setStudentProfileModalOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Student profile details"
          >
            <div className={styles.studentProfileModal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.studentProfileHeader}>
                <h4 className={styles.studentProfileTitle}>
                  {(detail.student.username || selectedStudentSummary?.username || 'Student') + "'s Profile"}
                </h4>
                <button
                  type="button"
                  className={styles.studentProfileClose}
                  onClick={() => setStudentProfileModalOpen(false)}
                  aria-label="Close student profile"
                >
                  ×
                </button>
              </div>
              <div className={styles.studentProfileBody}>
                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>Name</span>
                  <span className={styles.profileValue}>{detail.student.username || selectedStudentSummary?.username || '—'}</span>
                </div>
                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>Email</span>
                  <span className={styles.profileValueMuted}>{detail.student.email || selectedStudentSummary?.email || '—'}</span>
                </div>
                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>Major</span>
                  <span className={styles.profileValue}>{detail.student.major || selectedStudentSummary?.major || '—'}</span>
                </div>
                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>Title</span>
                  <span className={styles.profileValue}>{detail.student.title || '—'}</span>
                </div>
                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>Location</span>
                  <span className={styles.profileValue}>
                    {[detail.student.city, detail.student.state, detail.student.country].filter(Boolean).join(', ') || '—'}
                  </span>
                </div>
                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>Phone</span>
                  <span className={styles.profileValue}>{detail.student.phone || '—'}</span>
                </div>
                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>Target year</span>
                  <span className={styles.profileValue}>
                    {detail.student.target_year != null && !Number.isNaN(Number(detail.student.target_year))
                      ? Number(detail.student.target_year)
                      : '—'}
                  </span>
                </div>
                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>Bio</span>
                  <div className={styles.profileBio}>{detail.student.bio || 'No bio provided.'}</div>
                </div>
              </div>
            </div>
          </div>
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
