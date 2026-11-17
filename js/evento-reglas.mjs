export const QUESTION_COUNT = 8;
export const SECONDS_PER_QUESTION = 30;
export const AUDIENCES = ['general', 'ingenieria'];

export function multiplier(streak) {
  return 1 + Math.max(0, streak - 2) / 4;
}

export function pointsFor(seconds, streak) {
  return seconds * multiplier(streak) * 100;
}

export function instagramHandle(value) {
  if (typeof value !== 'string') return null;
  const handle = value.trim().replace(/^@/, '');
  if (!value.trim()) return '';
  return /^[a-zA-Z0-9_.]{1,30}$/.test(handle) ? handle : null;
}
