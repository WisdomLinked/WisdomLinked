import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../config';
import { formatDate } from '../utils/dateFormat';
import styles from './Profile.module.css';

export default function Profile() {
  const { token } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const headers = () => ({ Authorization: `Bearer ${token}` });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/auth/me`, { headers: headers() });
        if (!res.ok) throw new Error('Failed to load profile');
        const data = await res.json();
        if (!cancelled) setProfile(data);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Loading profile…</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>{error || 'Profile not found'}</p>
      </div>
    );
  }

  const isExpert = profile.role === 'expert' || profile.role === 'admin';

  return (
    <div className={styles.page}>
      <h2 className={styles.heading}>My Profile</h2>

      <div className={styles.profilePanel}>
        <div className={styles.profileRow}>
          <span className={styles.profileLabel}>Full name</span>
          <span className={styles.profileValue}>{profile.username || profile.email || '—'}</span>
        </div>
        <div className={styles.profileRow}>
          <span className={styles.profileLabel}>Email</span>
          <span className={styles.profileValue}>{profile.email || '—'}</span>
        </div>
        {(isExpert || profile.title) && (
          <div className={styles.profileRow}>
            <span className={styles.profileLabel}>Title</span>
            <span className={styles.profileValue}>{profile.title || '—'}</span>
          </div>
        )}
        <div className={styles.profileRow}>
          <span className={styles.profileLabel}>Short bio</span>
          <div className={styles.profileBio}>{profile.bio || '—'}</div>
        </div>
        <div className={styles.profileRow}>
          <span className={styles.profileLabel}>{isExpert ? 'Majors' : 'Major'}</span>
          <span className={styles.profileValue}>
            {isExpert && Array.isArray(profile.majors) && profile.majors.length > 0 ? (
              <>
                {profile.majors.map((m, i) => (
                  <span key={i} className={styles.profileTag}>{m}</span>
                ))}
              </>
            ) : profile.major ? (
              <span className={styles.profileTag}>{profile.major}</span>
            ) : (
              '—'
            )}
          </span>
        </div>
        <div className={styles.profileRow}>
          <span className={styles.profileLabel}>Country</span>
          <span className={styles.profileValue}>{profile.country || '—'}</span>
        </div>
        <div className={styles.profileRow}>
          <span className={styles.profileLabel}>State</span>
          <span className={styles.profileValue}>{profile.state || '—'}</span>
        </div>
        <div className={styles.profileRow}>
          <span className={styles.profileLabel}>City</span>
          <span className={styles.profileValue}>{profile.city || '—'}</span>
        </div>
        <div className={styles.profileRow}>
          <span className={styles.profileLabel}>Phone</span>
          <span className={styles.profileValue}>{profile.phone || '—'}</span>
        </div>
        <div className={styles.profileRow}>
          <span className={styles.profileLabel}>Registered</span>
          <span className={styles.profileValue}>{profile.created_at ? formatDate(profile.created_at, profile.timezone) : '—'}</span>
        </div>
      </div>
    </div>
  );
}
