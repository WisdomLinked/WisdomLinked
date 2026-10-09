import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DEFAULT_STUDENT_FILTERS, type ClientScope, type StudentFilters, type StudentSort } from './clientModel';

const SORTS: StudentSort[] = ['joined', 'intake', 'name'];

export type FilterPatch = Partial<StudentFilters & { scope: ClientScope }>;

/** Clients page filters, kept in the query string so they survive refresh and back/forward. */
export default function useClientFilters() {
  const [params, setParams] = useSearchParams();

  const { scope, filters } = useMemo(() => {
    const sort = params.get('sort') as StudentSort | null;
    return {
      scope: (params.get('scope') === 'all' ? 'all' : 'mine') as ClientScope,
      filters: {
        query: params.get('q') ?? '',
        country: params.get('country') ?? '',
        major: params.get('major') ?? '',
        degree: params.get('degree') ?? '',
        services: (params.get('services') ?? '').split(',').filter(Boolean),
        sortBy: sort && SORTS.includes(sort) ? sort : DEFAULT_STUDENT_FILTERS.sortBy,
      } as StudentFilters,
    };
  }, [params]);

  const update = (patch: FilterPatch, { replace = false } = {}) => {
    const next = { scope, ...filters, ...patch };
    const out = new URLSearchParams(params);
    const put = (key: string, value: string, fallback = '') => {
      if (value && value !== fallback) out.set(key, value);
      else out.delete(key);
    };
    put('scope', next.scope, 'mine');
    put('q', next.query.trim() ? next.query : '');
    put('country', next.country);
    put('major', next.major);
    put('degree', next.degree);
    put('services', next.services.join(','));
    put('sort', next.sortBy, DEFAULT_STUDENT_FILTERS.sortBy);
    setParams(out, { replace });
  };

  const clearFilters = () => update({ query: '', country: '', major: '', degree: '', services: [] });

  return { scope, filters, update, clearFilters };
}
