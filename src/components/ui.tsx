import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fmtDate, fmtTime, statusLabel } from '../lib/format';
import type { Pagination as P } from '../lib/types';

export const StatusMark = ({ status }: { status: string }) => (
  <span className={`mark ${status}`}>{statusLabel(status)}</span>
);

export function PageHead({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div><h1>{title}</h1>{children && <p>{children}</p>}</div>
      {actions}
    </header>
  );
}

export const Spinner = () => <span className="spinner" role="status" aria-label="Loading" />;

export const ErrorNote = ({ error }: { error: unknown }) => (
  <div className="note error" role="alert">{error instanceof Error ? error.message : 'Something went wrong.'}</div>
);

export const Empty = ({ title, children }: { title: string; children?: ReactNode }) => (
  <div className="empty"><strong>{title}</strong>{children}</div>
);

export function Pagination({ p, onPage }: { p?: P; onPage: (n: number) => void }) {
  if (!p || p.total === 0) return null;
  const from = (p.page - 1) * p.limit + 1;
  const to = Math.min(p.total, p.page * p.limit);
  return (
    <div className="pager">
      <span>{from}–{to} of {p.total}</span>
      <div className="row">
        <button className="btn small" disabled={p.page <= 1} onClick={() => onPage(p.page - 1)}><ChevronLeft size={15} />Previous</button>
        <button className="btn small" disabled={p.page >= p.totalPages} onClick={() => onPage(p.page + 1)}>Next<ChevronRight size={15} /></button>
      </div>
    </div>
  );
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** A date with its time underneath. `approx` flags a date that was estimated rather than recorded. */
export function When({ value, approx }: { value?: string | null; approx?: boolean }) {
  if (!value) return <span className="muted">—</span>;
  return (
    <span style={{ whiteSpace: 'nowrap' }} title={approx ? 'The exact time was not recorded. This is when the school record was last updated.' : undefined}>
      {fmtDate(value)}
      <span className="cell-sub" style={{ display: 'block' }}>{fmtTime(value)}{approx ? ', approx.' : ''}</span>
    </span>
  );
}
