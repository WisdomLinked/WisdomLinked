/** Parse OAuth `state` echoed from Google / WeChat (JSON or legacy plain role). */
export function parseOAuthState(rawState: string | undefined | null): {
  role: string | null;
  redirectPath: string;
  timezone: string;
} {
  const empty = { role: null as string | null, redirectPath: '', timezone: '' };
  const trimmed = String(rawState || '').trim();
  if (!trimmed) return empty;

  const tryParseJson = (value: string) => {
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object') return null;
      const role =
        typeof parsed.role === 'string' && parsed.role.trim() ? parsed.role.trim() : null;
      const redirectPath =
        typeof parsed.redirect === 'string' && parsed.redirect.trim().startsWith('/')
          ? parsed.redirect.trim()
          : '';
      const timezone =
        typeof parsed.timezone === 'string' && parsed.timezone.trim()
          ? parsed.timezone.trim()
          : '';
      return { role, redirectPath, timezone };
    } catch {
      return null;
    }
  };

  let parsed = tryParseJson(trimmed);
  if (!parsed) parsed = tryParseJson(decodeURIComponent(trimmed));
  if (parsed) return parsed;

  // Legacy: state was the role string directly.
  return { role: trimmed, redirectPath: '', timezone: '' };
}

/** Google/email OAuth from login must register first; WeChat has no email to pre-check. */
export function blocksNewUserWithoutRegisterRole(
  isNew: boolean,
  role: string | null,
  oauthProvider: string | undefined | null,
): boolean {
  if (!isNew) return false;
  if (oauthProvider === 'wechat') return false;
  if (!role || (role !== 'expert' && role !== 'customer')) return true;
  return false;
}

module.exports = { parseOAuthState, blocksNewUserWithoutRegisterRole };
