/**
 * Which Stripe modes admins may see in Payment History / Overview stats.
 *
 * PAYMENTS_VISIBLE_MODE=live  → only stripeMode "live" (production default)
 * PAYMENTS_VISIBLE_MODE=all   → live and test (staging)
 *
 * Defaults to "live" when unset so production stays safe.
 */
export type PaymentsVisibleMode = 'live' | 'all';

export function paymentsVisibleMode(
  env: NodeJS.ProcessEnv = process.env,
): PaymentsVisibleMode {
  const raw = String(env.PAYMENTS_VISIBLE_MODE || '').trim().toLowerCase();
  if (raw === 'all') return 'all';
  return 'live';
}

/**
 * Resolve the stripeMode filter to apply on a payments query.
 * - Production (`live`): always force live; ignore client "test" / "all"
 * - Staging (`all`): honor client filter when live|test; omit when empty/all
 */
export function resolveStripeModeFilter(
  requested: unknown,
  env: NodeJS.ProcessEnv = process.env,
): 'live' | 'test' | undefined {
  const visible = paymentsVisibleMode(env);
  if (visible === 'live') return 'live';
  const mode = String(requested || '').trim().toLowerCase();
  if (mode === 'live' || mode === 'test') return mode;
  return undefined;
}

/** Mongo match fragment for the visible-mode gate (empty when all modes allowed and no client filter). */
export function stripeModeMatch(
  requested: unknown,
  env: NodeJS.ProcessEnv = process.env,
): { stripeMode: 'live' | 'test' } | Record<string, never> {
  const mode = resolveStripeModeFilter(requested, env);
  return mode ? { stripeMode: mode } : {};
}
