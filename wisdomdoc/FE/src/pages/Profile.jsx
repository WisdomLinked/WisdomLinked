import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../config';
import { formatDate } from '../utils/dateFormat';
import { TIMEZONES } from '../constants/timezones';
import { COMMON_MAJORS } from '../constants/majors';
import styles from './Profile.module.css';

function initialDraft(p) {
  if (!p) return null;
  return {
    username: p.username || '',
    title: p.title || '',
    bio: p.bio || '',
    major: p.major || '',
    majorsText: Array.isArray(p.majors) ? p.majors.join('\n') : '',
    phone: p.phone || '',
    country: p.country || '',
    state: p.state || '',
    city: p.city || '',
    timezone: p.timezone || 'America/Chicago',
    targetYear: p.target_year != null && !Number.isNaN(Number(p.target_year)) ? String(Number(p.target_year)) : '',
  };
}

export default function Profile() {
  const { token, user, setAuth } = useAuth();
  const [profile, setProfile] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const admissionYears = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 14 }, (_, i) => y - 3 + i);
  }, []);

  const headers = () => ({ Authorization: `Bearer ${token}` });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/auth/me`, { headers: headers() });
        if (!res.ok) throw new Error('Failed to load profile');
        const data = await res.json();
        if (!cancelled) {
          setProfile(data);
          setDraft(initialDraft(data));
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  function updateDraft(field, value) {
    setDraft((d) => (d ? { ...d, [field]: value } : d));
    setSaveMessage('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!profile || !draft) return;
    setSaveMessage('');
    setSaving(true);
    try {
      const body = {
        username: draft.username.trim() || null,
        title: draft.title.trim() || null,
        bio: draft.bio.trim() || null,
        phone: draft.phone.trim() || null,
        country: draft.country.trim() || null,
        state: draft.state.trim() || null,
        city: draft.city.trim() || null,
        timezone: draft.timezone,
      };
      if (profile.role === 'student') {
        body.major = draft.major.trim() || null;
        body.target_year = draft.targetYear === '' ? null : Number(draft.targetYear);
      }
      if (profile.role === 'expert' || profile.role === 'admin') {
        body.majors = draft.majorsText
          .split(/\n/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      const res = await fetch(`${API}/auth/me`, {
        method: 'PATCH',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save profile');
      setProfile(data);
      setDraft(initialDraft(data));
      if (user && token) {
        setAuth(token, {
          ...user,
          username: data.username,
          bio: data.bio,
          title: data.title,
          major: data.major,
          majors: data.majors,
          timezone: data.timezone,
          phone: data.phone,
          country: data.country,
          state: data.state,
          city: data.city,
          target_year: data.target_year,
        });
      }
      setSaveMessage('Profile saved.');
    } catch (err) {
      setSaveMessage(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Loading profile…</p>
      </div>
    );
  }

  if (error || !profile || !draft) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>{error || 'Profile not found'}</p>
      </div>
    );
  }

  const isExpertLike = profile.role === 'expert' || profile.role === 'admin';
  const saveFailed = saveMessage && !saveMessage.startsWith('Profile saved');

  return (
    <div className={styles.page}>
      <h2 className={styles.heading}>My Profile</h2>
      <p className={styles.intro}>
        You can update your details below. Note that your email cannot be changed, as it is used as your login identifier.
      </p>

      <form className={styles.profilePanel} onSubmit={handleSubmit}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Full name</span>
          <input
            type="text"
            className={styles.fieldInput}
            value={draft.username}
            onChange={(e) => updateDraft('username', e.target.value)}
            autoComplete="name"
            maxLength={100}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Email</span>
          <input
            type="email"
            className={styles.emailLocked}
            value={profile.email || ''}
            disabled
            readOnly
            aria-readonly="true"
            title="Email cannot be changed"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Title</span>
          <input
            type="text"
            className={styles.fieldInput}
            value={draft.title}
            onChange={(e) => updateDraft('title', e.target.value)}
            maxLength={200}
            placeholder={isExpertLike ? 'e.g. Professor of Engineering' : 'Optional'}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Short bio</span>
          <textarea
            className={styles.fieldTextarea}
            value={draft.bio}
            onChange={(e) => updateDraft('bio', e.target.value)}
            rows={5}
            maxLength={2000}
            placeholder={isExpertLike ? 'At least 30 characters if you add a bio' : 'Optional'}
          />
          {isExpertLike && (
            <span className={styles.fieldHint}>Experts: if you enter a bio, it must be at least 30 characters.</span>
          )}
        </label>

        {isExpertLike ? (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Majors (committee matching)</span>
            <textarea
              className={styles.fieldTextarea}
              value={draft.majorsText}
              onChange={(e) => updateDraft('majorsText', e.target.value)}
              rows={4}
              placeholder="One area per line"
            />
          </label>
        ) : (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Major</span>
            <input
              type="text"
              className={styles.fieldInput}
              value={draft.major}
              onChange={(e) => updateDraft('major', e.target.value)}
              list="profile-common-majors"
            />
            <datalist id="profile-common-majors">
              {COMMON_MAJORS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
        )}

        {profile.role === 'student' && (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Target year</span>
            <select
              className={styles.fieldInput}
              value={draft.targetYear}
              onChange={(e) => updateDraft('targetYear', e.target.value)}
              aria-label="Admission or enrollment target year"
            >
              <option value="">Not set</option>
              {admissionYears.map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
            <span className={styles.fieldHint}>Used for committee search and filters.</span>
          </label>
        )}

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Timezone</span>
          <select
            className={styles.fieldInput}
            value={draft.timezone}
            onChange={(e) => updateDraft('timezone', e.target.value)}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Country</span>
          <input
            type="text"
            className={styles.fieldInput}
            value={draft.country}
            onChange={(e) => updateDraft('country', e.target.value)}
            maxLength={100}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>State / Province</span>
          <input
            type="text"
            className={styles.fieldInput}
            value={draft.state}
            onChange={(e) => updateDraft('state', e.target.value)}
            maxLength={100}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>City</span>
          <input
            type="text"
            className={styles.fieldInput}
            value={draft.city}
            onChange={(e) => updateDraft('city', e.target.value)}
            maxLength={100}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Phone</span>
          <input
            type="tel"
            className={styles.fieldInput}
            value={draft.phone}
            onChange={(e) => updateDraft('phone', e.target.value)}
            maxLength={30}
            autoComplete="tel"
          />
        </label>

        <div className={styles.readonlyRow}>
          <span className={styles.fieldLabel}>Registered</span>
          <span className={styles.readonlyValue}>
            {profile.created_at ? formatDate(profile.created_at, profile.timezone) : '—'}
          </span>
        </div>

        <div className={styles.saveBar}>
          <button type="submit" className={styles.saveBtn} disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
          {saveMessage && (
            <span className={saveFailed ? styles.saveError : styles.saveOk} role="status">{saveMessage}</span>
          )}
        </div>
      </form>
    </div>
  );
}
