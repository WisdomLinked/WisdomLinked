import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API } from '../config';
import { COMMON_MAJORS } from '../constants/majors';
import { TIMEZONES } from '../constants/timezones';
import { COUNTRIES, COUNTRY_CODES } from '../constants/countries';
import styles from './Login.module.css';

export default function Login() {
  const [view, setView] = useState('main');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [expertEmail, setExpertEmail] = useState('');
  const [expertPassword, setExpertPassword] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [regStudentEmail, setRegStudentEmail] = useState('');
  const [regStudentPassword, setRegStudentPassword] = useState('');
  const [regStudentMajor, setRegStudentMajor] = useState('');
  const [regStudentMajorOther, setRegStudentMajorOther] = useState('');
  const [regExpertEmail, setRegExpertEmail] = useState('');
  const [regExpertPassword, setRegExpertPassword] = useState('');
  const [regExpertUsername, setRegExpertUsername] = useState('');
  const [regExpertMajors, setRegExpertMajors] = useState('');
  const [regExpertTitle, setRegExpertTitle] = useState('');
  const [regExpertBio, setRegExpertBio] = useState('');
  const [regExpertCountry, setRegExpertCountry] = useState('');
  const [regExpertState, setRegExpertState] = useState('');
  const [regExpertCity, setRegExpertCity] = useState('');
  const [regExpertCountryCode, setRegExpertCountryCode] = useState('+1');
  const [regExpertPhone, setRegExpertPhone] = useState('');
  const [regStudentUsername, setRegStudentUsername] = useState('');
  const [regStudentTimezone, setRegStudentTimezone] = useState('America/Chicago');
  const [regExpertTimezone, setRegExpertTimezone] = useState('America/Chicago');
  const [regStudentBio, setRegStudentBio] = useState('');
  const [regStudentCountry, setRegStudentCountry] = useState('');
  const [regStudentState, setRegStudentState] = useState('');
  const [regStudentCity, setRegStudentCity] = useState('');
  const [regStudentCountryCode, setRegStudentCountryCode] = useState('+1');
  const [regStudentPhone, setRegStudentPhone] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetLink, setResetLink] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  function goToMain() {
    setView('main');
    setError('');
  }

  function goBack() {
    if (view.startsWith('login')) setView('login');
    else if (view.startsWith('register')) setView('register');
    else if (view === 'forgotPassword') setView('login');
    setError('');
    setResetLink('');
  }

  function getStudentMajor() {
    if (regStudentMajor === 'Other') return regStudentMajorOther.trim() || null;
    return regStudentMajor || null;
  }

  function getExpertMajorsList() {
    return regExpertMajors.split(',').map(m => m.trim()).filter(Boolean);
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    setResetLink('');
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Request failed');
        return;
      }
      if (data.token) {
        const base = window.location.origin + (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
        setResetLink(`${base}/reset-password?token=${data.token}`);
      } else {
        setResetLink('sent');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handleStudentSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: studentEmail, password: studentPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      if (data.user?.role !== 'student') {
        setError('Not a student account. Use Expert or Admin login.');
        return;
      }
      setAuth(data.token, data.user);
      navigate('/', { replace: true });
    } catch (err) {
      setError('Network error. Is the server running?');
    } finally {
      setLoading(false);
    }
  }

  async function handleExpertSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: expertEmail, password: expertPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      if (data.user?.role !== 'expert') {
        setError('Not an expert account. Use Student or Admin login.');
        return;
      }
      setAuth(data.token, data.user);
      navigate('/committee', { replace: true });
    } catch (err) {
      setError('Network error. Is the server running?');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      if (data.user?.role !== 'admin') {
        setError('Not an admin account.');
        return;
      }
      setAuth(data.token, data.user);
      navigate('/committee', { replace: true });
    } catch (err) {
      setError('Network error. Is the server running?');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterStudent(e) {
    e.preventDefault();
    const major = getStudentMajor();
    if (!major) {
      setError('Please select or enter your major');
      return;
    }
    if (!regStudentUsername.trim()) {
      setError('Full name is required');
      return;
    }
    if (!regStudentCountry) {
      setError('Country is required');
      return;
    }
    const phoneDigits = regStudentPhone.replace(/\s/g, '');
    if (!phoneDigits || !/^\d{6,15}$/.test(phoneDigits)) {
      setError('Enter a valid phone number');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const phone = regStudentCountryCode + phoneDigits;
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regStudentEmail, password: regStudentPassword, role: 'student',
          major, timezone: regStudentTimezone, username: regStudentUsername.trim(),
          country: regStudentCountry, state: regStudentState.trim() || undefined, city: regStudentCity.trim() || undefined, phone,
          ...(regStudentBio.trim() && { bio: regStudentBio.trim() }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }
      setAuth(data.token, data.user);
      navigate('/', { replace: true });
    } catch (err) {
      setError('Network error. Is the server running?');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterExpert(e) {
    e.preventDefault();
    if (!regExpertUsername.trim()) {
      setError('Full name is required');
      return;
    }
    if (!regExpertTitle.trim()) {
      setError('Title is required');
      return;
    }
    const bioTrim = regExpertBio.trim();
    if (!bioTrim || bioTrim.length < 30) {
      setError('Short bio is required (at least 30 characters)');
      return;
    }
    const majors = getExpertMajorsList();
    if (majors.length === 0) {
      setError('Enter at least one major (comma-separated)');
      return;
    }
    if (!regExpertCountry) {
      setError('Country is required');
      return;
    }
    const phoneDigits = regExpertPhone.replace(/\s/g, '');
    if (!phoneDigits || !/^\d{6,15}$/.test(phoneDigits)) {
      setError('Enter a valid phone number');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const phone = regExpertCountryCode + phoneDigits;
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regExpertEmail, password: regExpertPassword, role: 'expert',
          majors, timezone: regExpertTimezone, username: regExpertUsername.trim(),
          title: regExpertTitle.trim(), bio: bioTrim, country: regExpertCountry, state: regExpertState.trim() || undefined, city: regExpertCity.trim() || undefined, phone,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }
      setAuth(data.token, data.user);
      navigate('/committee', { replace: true });
    } catch (err) {
      setError('Network error. Is the server running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>
          <span className="gradient_text">Wisdom Document System</span>
        </h1>

        {view === 'main' && (
          <div className={styles.choice}>
            <button
              type="button"
              className={styles.choiceBtn}
              onClick={() => { setView('login'); setError(''); }}
            >
              Login
            </button>
            <button
              type="button"
              className={styles.choiceBtnCommittee}
              onClick={() => { setView('register'); setError(''); }}
            >
              Register
            </button>
          </div>
        )}

        {view === 'login' && (
          <div className={styles.choice}>
            <p className={styles.choiceHint}>Choose login type</p>
            <button
              type="button"
              className={styles.choiceBtn}
              onClick={() => { setView('loginStudent'); setError(''); }}
            >
              Student login
            </button>
            <button
              type="button"
              className={styles.choiceBtnCommittee}
              onClick={() => { setView('loginExpert'); setError(''); }}
            >
              Expert login
            </button>
            <button
              type="button"
              className={styles.choiceBtnCommittee}
              onClick={() => { setView('loginAdmin'); setError(''); }}
            >
              Admin login
            </button>
            <button type="button" className={styles.toggle} onClick={() => { setView('forgotPassword'); setError(''); setResetLink(''); }}>
              Forgot password?
            </button>
            <button type="button" className={styles.toggle} onClick={goToMain}>
              ← Back
            </button>
          </div>
        )}

        {view === 'forgotPassword' && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Forgot password</h2>
            {!resetLink ? (
              <form onSubmit={handleForgotPassword} className={styles.form}>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  className={styles.input}
                  required
                />
                <button type="submit" className={styles.btn} disabled={loading}>
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            ) : resetLink === 'sent' ? (
              <p className={styles.successMsg}>If that email exists, a reset link was sent. Check your email.</p>
            ) : (
              <div>
                <p className={styles.choiceHint}>Use this link to reset your password (valid 1 hour):</p>
                <a href={resetLink} className={styles.resetLink} target="_blank" rel="noopener noreferrer">
                  Reset password
                </a>
              </div>
            )}
            <button type="button" className={styles.toggle} onClick={goBack}>
              ← Back
            </button>
          </div>
        )}

        {view === 'register' && (
          <div className={styles.choice}>
            <p className={styles.choiceHint}>Choose registration type</p>
            <button
              type="button"
              className={styles.choiceBtn}
              onClick={() => { setView('registerStudent'); setError(''); }}
            >
              Student register
            </button>
            <button
              type="button"
              className={styles.choiceBtnCommittee}
              onClick={() => { setView('registerExpert'); setError(''); }}
            >
              Expert register
            </button>
            <button type="button" className={styles.toggle} onClick={goToMain}>
              ← Back
            </button>
          </div>
        )}

        {view === 'loginStudent' && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Student login</h2>
            <form onSubmit={handleStudentSubmit} className={styles.form}>
              <input
                type="email"
                placeholder="Email"
                value={studentEmail}
                onChange={e => setStudentEmail(e.target.value)}
                className={styles.input}
                required
                autoComplete="email"
              />
              <input
                type="password"
                placeholder="Password"
                value={studentPassword}
                onChange={e => setStudentPassword(e.target.value)}
                className={styles.input}
                required
                autoComplete="current-password"
              />
              <button type="submit" className={styles.btn} disabled={loading}>
                {loading ? 'Please wait…' : 'Login'}
              </button>
            </form>
            <button type="button" className={styles.toggle} onClick={() => { setView('forgotPassword'); setError(''); setResetLink(''); }}>
              Forgot password?
            </button>
            <button type="button" className={styles.toggle} onClick={goBack}>
              ← Back
            </button>
          </div>
        )}

        {view === 'loginExpert' && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Expert login</h2>
            <form onSubmit={handleExpertSubmit} className={styles.form}>
              <input
                type="email"
                placeholder="Email"
                value={expertEmail}
                onChange={e => setExpertEmail(e.target.value)}
                className={styles.input}
                required
                autoComplete="email"
              />
              <input
                type="password"
                placeholder="Password"
                value={expertPassword}
                onChange={e => setExpertPassword(e.target.value)}
                className={styles.input}
                required
                autoComplete="current-password"
              />
              <button type="submit" className={styles.btnCommittee} disabled={loading}>
                {loading ? 'Please wait…' : 'Login'}
              </button>
            </form>
            <button type="button" className={styles.toggle} onClick={() => { setView('forgotPassword'); setError(''); setResetLink(''); }}>
              Forgot password?
            </button>
            <button type="button" className={styles.toggle} onClick={goBack}>
              ← Back
            </button>
          </div>
        )}

        {view === 'loginAdmin' && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Admin login</h2>
            <form onSubmit={handleAdminSubmit} className={styles.form}>
              <input
                type="email"
                placeholder="Email"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                className={styles.input}
                required
                autoComplete="email"
              />
              <input
                type="password"
                placeholder="Password"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                className={styles.input}
                required
                autoComplete="current-password"
              />
              <button type="submit" className={styles.btnCommittee} disabled={loading}>
                {loading ? 'Please wait…' : 'Login'}
              </button>
            </form>
            <button type="button" className={styles.toggle} onClick={() => { setView('forgotPassword'); setError(''); setResetLink(''); }}>
              Forgot password?
            </button>
            <button type="button" className={styles.toggle} onClick={goBack}>
              ← Back
            </button>
          </div>
        )}

        {view === 'registerStudent' && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Student register</h2>
            <form onSubmit={handleRegisterStudent} className={styles.form}>
              <input
                type="text"
                placeholder="Full name"
                value={regStudentUsername}
                onChange={e => setRegStudentUsername(e.target.value)}
                className={styles.input}
                required
                autoComplete="name"
              />
              <input
                type="email"
                placeholder="Email"
                value={regStudentEmail}
                onChange={e => setRegStudentEmail(e.target.value)}
                className={styles.input}
                required
                autoComplete="email"
              />
              <input
                type="password"
                placeholder="Password"
                value={regStudentPassword}
                onChange={e => setRegStudentPassword(e.target.value)}
                className={styles.input}
                required
                autoComplete="new-password"
              />
              <label className={styles.label}>Major</label>
              <select
                value={regStudentMajor}
                onChange={e => setRegStudentMajor(e.target.value)}
                className={styles.input}
                required
              >
                <option value="">Select or type below if not in list</option>
                {COMMON_MAJORS.filter(m => m !== 'Other').map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
                <option value="Other">Other (type below)</option>
              </select>
              {(regStudentMajor === 'Other' || !COMMON_MAJORS.includes(regStudentMajor)) && regStudentMajor && (
                <input
                  type="text"
                  placeholder="Type your major"
                  value={regStudentMajorOther}
                  onChange={e => setRegStudentMajorOther(e.target.value)}
                  className={styles.input}
                />
              )}
              <label className={styles.label}>Country</label>
              <select
                value={regStudentCountry}
                onChange={e => setRegStudentCountry(e.target.value)}
                className={styles.input}
                required
              >
                <option value="">Select country</option>
                {COUNTRIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <label className={styles.label}>State (optional)</label>
              <input
                type="text"
                placeholder="e.g. Texas"
                value={regStudentState}
                onChange={e => setRegStudentState(e.target.value)}
                className={styles.input}
              />
              <label className={styles.label}>City (optional)</label>
              <input
                type="text"
                placeholder="e.g. College Station"
                value={regStudentCity}
                onChange={e => setRegStudentCity(e.target.value)}
                className={styles.input}
              />
              <label className={styles.label}>Phone</label>
              <div className={styles.phoneRow}>
                <select
                  value={regStudentCountryCode}
                  onChange={e => setRegStudentCountryCode(e.target.value)}
                  className={styles.phoneCode}
                >
                  {COUNTRY_CODES.map(cc => (
                    <option key={cc.code} value={cc.code}>{cc.flag} {cc.code}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  placeholder="Phone number (digits only)"
                  value={regStudentPhone}
                  onChange={e => setRegStudentPhone(e.target.value)}
                  className={styles.input}
                  required
                  autoComplete="tel"
                />
              </div>
              <label className={styles.label}>Short bio (optional)</label>
              <textarea
                placeholder="e.g. A brief introduction about yourself"
                value={regStudentBio}
                onChange={e => setRegStudentBio(e.target.value)}
                className={styles.input}
                rows={3}
              />
              <label className={styles.label}>Timezone</label>
              <select
                value={regStudentTimezone}
                onChange={e => setRegStudentTimezone(e.target.value)}
                className={styles.input}
              >
                {TIMEZONES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <button type="submit" className={styles.btn} disabled={loading}>
                {loading ? 'Please wait…' : 'Register'}
              </button>
            </form>
            <button type="button" className={styles.toggle} onClick={goBack}>
              ← Back
            </button>
          </div>
        )}

        {view === 'registerExpert' && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Expert register</h2>
            <form onSubmit={handleRegisterExpert} className={styles.form}>
              <input
                type="text"
                placeholder="Full name"
                value={regExpertUsername}
                onChange={e => setRegExpertUsername(e.target.value)}
                className={styles.input}
                required
                autoComplete="name"
              />
              <input
                type="text"
                placeholder="Title (e.g. Professor, Senior Engineer)"
                value={regExpertTitle}
                onChange={e => setRegExpertTitle(e.target.value)}
                className={styles.input}
                required
              />
              <label className={styles.label}>Short bio (min 30 characters)</label>
              <textarea
                placeholder="Describe your expertise and background..."
                value={regExpertBio}
                onChange={e => setRegExpertBio(e.target.value)}
                className={styles.input}
                rows={4}
                required
              />
              <input
                type="text"
                placeholder="Majors you handle (comma-separated, e.g. CS, ECE)"
                value={regExpertMajors}
                onChange={e => setRegExpertMajors(e.target.value)}
                className={styles.input}
              />
              <label className={styles.label}>Country</label>
              <select
                value={regExpertCountry}
                onChange={e => setRegExpertCountry(e.target.value)}
                className={styles.input}
                required
              >
                <option value="">Select country</option>
                {COUNTRIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <label className={styles.label}>State (optional)</label>
              <input
                type="text"
                placeholder="e.g. Texas"
                value={regExpertState}
                onChange={e => setRegExpertState(e.target.value)}
                className={styles.input}
              />
              <label className={styles.label}>City (optional)</label>
              <input
                type="text"
                placeholder="e.g. College Station"
                value={regExpertCity}
                onChange={e => setRegExpertCity(e.target.value)}
                className={styles.input}
              />
              <label className={styles.label}>Phone</label>
              <div className={styles.phoneRow}>
                <select
                  value={regExpertCountryCode}
                  onChange={e => setRegExpertCountryCode(e.target.value)}
                  className={styles.phoneCode}
                >
                  {COUNTRY_CODES.map(cc => (
                    <option key={cc.code} value={cc.code}>{cc.flag} {cc.code}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  placeholder="Phone number (digits only)"
                  value={regExpertPhone}
                  onChange={e => setRegExpertPhone(e.target.value)}
                  className={styles.input}
                  required
                  autoComplete="tel"
                />
              </div>
              <input
                type="email"
                placeholder="Email"
                value={regExpertEmail}
                onChange={e => setRegExpertEmail(e.target.value)}
                className={styles.input}
                required
                autoComplete="email"
              />
              <input
                type="password"
                placeholder="Password"
                value={regExpertPassword}
                onChange={e => setRegExpertPassword(e.target.value)}
                className={styles.input}
                required
                autoComplete="new-password"
              />
              <label className={styles.label}>Timezone</label>
              <select
                value={regExpertTimezone}
                onChange={e => setRegExpertTimezone(e.target.value)}
                className={styles.input}
              >
                {TIMEZONES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <button type="submit" className={styles.btnCommittee} disabled={loading}>
                {loading ? 'Please wait…' : 'Register'}
              </button>
            </form>
            <button type="button" className={styles.toggle} onClick={goBack}>
              ← Back
            </button>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
}
