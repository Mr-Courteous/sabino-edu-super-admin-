import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Student } from '../lib/types';
import { Empty, ErrorNote, PageHead, Pagination, When, useDebounced } from '../components/ui';

export default function Students() {
  const [sp, setSp] = useSearchParams();
  const schoolId = sp.get('schoolId') ?? '';
  const page = Number(sp.get('page') ?? 1);
  const [text, setText] = useState(sp.get('q') ?? '');
  const search = useDebounced(text);

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setSp(next, { replace: true });
  };
  useEffect(() => { if (search !== (sp.get('q') ?? '')) update({ q: search, page: '' }); /* eslint-disable-next-line */ }, [search]);

  const { data, error, isFetching } = useQuery({
    queryKey: ['students', { schoolId, q: sp.get('q') ?? '', page }],
    queryFn: () => api<Student[]>('/students', { query: { schoolId, search: sp.get('q') ?? '', page } }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="stack">
      <PageHead title="Students">Read-only view of students across all schools.</PageHead>
      <div>
        <div className="filters">
          <input type="search" placeholder="Search students" aria-label="Search students" value={text} onChange={(e) => setText(e.target.value)} />
          {schoolId && <button className="chip" onClick={() => update({ schoolId: '', page: '' })}>School #{schoolId}: clear</button>}
        </div>
        {!!error && <ErrorNote error={error} />}
        <div className="ledger-wrap" style={{ opacity: isFetching ? 0.7 : 1 }}>
          {data && data.data.length === 0 ? <Empty title="No students found" /> : (
            <table className="ledger cards">
              <thead><tr><th>Student</th><th>Email</th><th>School</th><th>Added</th></tr></thead>
              <tbody>{data?.data.map((st) => (
                <tr key={st.id}>
                  <td className="cell-title">{st.first_name} {st.last_name}</td>
                  <td data-label="Email">{st.email ?? '—'}</td>
                  <td data-label="School"><Link to={`/schools/${st.school_id}`}>{st.school_name ?? `School #${st.school_id}`}</Link></td>
                  <td data-label="Added"><When value={st.created_at} /></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
        <Pagination p={data?.pagination} onPage={(n) => update({ page: String(n) })} />
      </div>
    </div>
  );
}
