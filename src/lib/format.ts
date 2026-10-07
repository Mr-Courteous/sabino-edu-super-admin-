import type { AuditEntry, PaymentStatus } from './types';

export const STATUS_LABEL: Record<PaymentStatus, string> = {
  completed: 'Completed', grace_period: 'Grace period', expired: 'Expired', pending: 'Pending',
};
export const statusLabel = (s: string) => STATUS_LABEL[s as PaymentStatus] ?? s;

export const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
export const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function daysLeft(d?: string | null): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}
export function expiryNote(d?: string | null) {
  const n = daysLeft(d);
  if (n === null) return '';
  if (n < 0) return `ended ${-n} day${n === -1 ? '' : 's'} ago`;
  if (n === 0) return 'ends today';
  return `${n} day${n === 1 ? '' : 's'} left`;
}

export function money(amount: string | null, currency: string | null) {
  if (amount === null) return '—';
  try { return new Intl.NumberFormat('en-NG', { style: 'currency', currency: currency || 'NGN' }).format(Number(amount)); }
  catch { return `${currency ?? ''} ${amount}`.trim(); }
}

// yyyy-mm-dd (from <input type=date>) → end of that day in the viewer's timezone, as ISO.
export function endOfDayISO(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59).toISOString();
}
export function addToToday(opts: { days?: number; months?: number }) {
  const d = new Date();
  if (opts.months) d.setMonth(d.getMonth() + opts.months);
  if (opts.days) d.setDate(d.getDate() + opts.days);
  return toYMD(d);
}
export const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const ACTION_LABEL: Record<string, string> = {
  'school.payment_status_changed': 'Changed payment status',
  'auth.login': 'Signed in',
  'auth.login_failed': 'Failed sign-in',
  'auth.login_blocked': 'Blocked sign-in (deactivated)',
  'auth.password_changed': 'Changed own password',
  'admin.created': 'Added admin',
  'admin.bootstrap': 'Created first owner',
  'admin.role_changed': 'Changed admin role',
  'admin.deactivated': 'Deactivated admin',
  'admin.reactivated': 'Reactivated admin',
  'admin.renamed': 'Renamed admin',
  'admin.password_reset': 'Reset admin password',
  'notification.sent': 'Sent notification',
};
export const actionLabel = (a: string) =>
  ACTION_LABEL[a] ?? a.replace(/[._]/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** One plain sentence describing what an audit entry changed. */
export function describe(e: Pick<AuditEntry, 'action' | 'details'>): string {
  const d = e.details ?? {};
  switch (e.action) {
    case 'school.payment_status_changed': {
      const from = d.from?.status ? statusLabel(d.from.status) : '?';
      const to = d.to?.status ? statusLabel(d.to.status) : '?';
      const until = d.to?.expiry ? `, until ${fmtDate(d.to.expiry)}` : '';
      return `${from} to ${to}${until}${d.reason ? ` — “${d.reason}”` : ''}`;
    }
    case 'admin.role_changed': return `${d.from} to ${d.to}`;
    case 'admin.created': return `Role: ${d.role}`;
    case 'admin.renamed': return `${d.from} to ${d.to}`;
    case 'auth.login_blocked': return d.reason ?? '';
    case 'notification.sent': return `${d.audienceLabel}: “${d.title}” (${d.sent} of ${d.recipients} devices)`;
    default: return '';
  }
}
