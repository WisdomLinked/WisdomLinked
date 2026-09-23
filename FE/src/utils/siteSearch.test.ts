import { describe, expect, it } from 'vitest';
import {
  adminUserMgmtEmailHref,
  hrefForFindExperts,
  isEmailQuery,
  isSeminarCoverUrl,
  loggedOutExpertHref,
  loggedOutSeminarHref,
  studentSearchActions,
} from './siteSearch';

describe('homepage search redirect encoding', () => {
  it('keeps the expert id inside redirect and does not add a sibling expert parameter', () => {
    const href = loggedOutExpertHref('exp-42');
    expect(href.startsWith('/login?redirect=')).toBe(true);
    expect(href).not.toBe('/user/studentdashboard?expert=exp-42');
    expect(href).not.toContain('/user/studentdashboard?expert=');
    const params = new URLSearchParams(href.slice(href.indexOf('?') + 1));
    expect([...params.keys()]).toEqual(['redirect']);
    expect(params.has('expert')).toBe(false);
    expect(params.get('redirect')).toBe('/user/studentdashboard?expert=exp-42');
  });

  it('keeps the seminar id inside redirect the same way', () => {
    const href = loggedOutSeminarHref('sem-7');
    const params = new URLSearchParams(href.slice(href.indexOf('?') + 1));
    expect(href.startsWith('/login?redirect=')).toBe(true);
    expect([...params.keys()]).toEqual(['redirect']);
    expect(params.has('seminar')).toBe(false);
    expect(params.get('redirect')).toBe('/user/studentdashboard?seminar=sem-7');
  });

  it('encodes Find experts inside the logged-out redirect', () => {
    const href = hrefForFindExperts('public', 'cell biology')!;
    const params = new URLSearchParams(href.slice(href.indexOf('?') + 1));
    expect([...params.keys()]).toEqual(['redirect']);
    expect(params.get('redirect')).toBe('/user/studentdashboard?expertsQuery=cell+biology');
  });
});

describe('student dashboard search params', () => {
  it('does not treat a seminar id or a student id as an expert id', () => {
    const seminarActions = studentSearchActions('?seminar=sem-7');
    expect(seminarActions).toEqual([{ type: 'open-seminar', seminarId: 'sem-7' }]);
    expect(seminarActions.some((action) => action.type === 'open-expert')).toBe(false);
    expect(JSON.stringify(seminarActions)).not.toContain('wl_open_seminar_id');
    expect(JSON.stringify(seminarActions)).not.toContain('student_booking');

    const studentActions = studentSearchActions('?student=stu-1');
    expect(studentActions).toEqual([]);
  });

  it('opens an expert profile only from the expert param', () => {
    expect(studentSearchActions('?expert=exp-42')).toEqual([
      { type: 'open-expert', expertId: 'exp-42' },
    ]);
  });

  it('prefills Find experts and StudentSeminars without other params', () => {
    expect(studentSearchActions('?expertsQuery=biology&major=all')).toEqual([
      { type: 'prefill-experts', query: 'biology' },
    ]);
    expect(studentSearchActions('?seminarsQuery=cells')).toEqual([
      { type: 'prefill-seminars', query: 'cells' },
    ]);
  });
});

describe('admin email link', () => {
  it('builds the user management email query', () => {
    expect(isEmailQuery('ada@school.edu')).toBe(true);
    expect(isEmailQuery('biology')).toBe(false);
    const href = adminUserMgmtEmailHref('ada@school.edu');
    const params = new URLSearchParams(href.slice(href.indexOf('?') + 1));
    expect(href.startsWith('/user/admindashboard/usermgmt?')).toBe(true);
    expect(params.get('email')).toBe('ada@school.edu');
  });
});

describe('seminar cover urls', () => {
  it('treats an https chatFiles url as a cover and a filename as not a cover', () => {
    expect(isSeminarCoverUrl('https://cdn.example.com/bucket/chatFiles/cover.jpg')).toBe(true);
    expect(isSeminarCoverUrl('http://cdn.example.com/bucket/chatFiles/cover.jpg')).toBe(false);
    expect(isSeminarCoverUrl('host.png')).toBe(false);
  });
});
