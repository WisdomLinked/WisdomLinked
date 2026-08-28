/**
 * Must match BE `toRocketChatUsername` in services/rocketchat.service.ts
 * so we can tell if a Rocket.Chat message was sent by the logged-in user.
 */
export function toRocketChatUsername(email: string | undefined | null): string {
  if (!email || typeof email !== 'string') {
    return 'wl_user';
  }
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  const sanitize = (s: string) =>
    s.replace(/[^a-z0-9._-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  let combined: string;
  if (at <= 0) {
    combined = sanitize(trimmed) || 'wl_user';
  } else {
    const local = sanitize(trimmed.slice(0, at));
    const domain = sanitize(trimmed.slice(at + 1));
    combined = `${local}_${domain}`.replace(/_+/g, '_').replace(/^_|_$/g, '') || 'wl_user';
  }
  if (combined.length < 3) {
    combined = `${combined}_wl`;
  }
  if (/^[0-9._-]/.test(combined)) {
    combined = `u_${combined}`;
  }
  return combined.slice(0, 32);
}
