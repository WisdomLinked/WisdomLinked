import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import Avatar from '../../../../components/Avatar';
import UserActionsMenu from './UserActionsMenu';

export type AdminUserRow = {
  _id?: string;
  email?: string;
  username?: string;
  title?: string;
  role?: string;
  status?: string;
  image?: string;
  phoneNumber?: string;
  resume?: string;
  country?: { name?: string };
  state?: { name?: string };
  city?: { name?: string };
};

function userKey(u: AdminUserRow, idx: number) {
  return String(u._id || u.email || idx);
}

function dash(value?: string | null) {
  const text = value?.trim();
  return text ? text : '—';
}

function roleClass(role?: string) {
  return role === 'expert' ? 'text-brownyellow' : 'text-wl-brand';
}

function UserIdentity({ user }: { user: AdminUserRow }) {
  return (
    <div className="min-w-0">
      <div className="truncate font-medium text-wl-ink">{dash(user.username)}</div>
      <div className="truncate text-sm text-wl-muted">{dash(user.email)}</div>
    </div>
  );
}

function UserStatusSelect({
  user,
  onChange,
}: {
  user: AdminUserRow;
  onChange: (status: string) => void;
}) {
  return (
    <select
      aria-label={`Status for ${user.username || user.email || 'user'}`}
      className={`w-full max-w-[9rem] rounded-lg border border-wl-line bg-wl-card px-2 py-1 text-[13px] text-wl-ink outline-none focus:ring-2 focus:ring-wl-brand/20 ${
        user.status === 'active'
          ? 'font-medium text-wl-brand'
          : user.status === 'blocked'
            ? 'text-red'
            : 'text-brownyellow'
      }`}
      value={user.status || 'review'}
      onClick={e => e.stopPropagation()}
      onChange={e => onChange(e.target.value)}
    >
      <option value="active" className="text-wl-brand">
        Active
      </option>
      <option value="review" className="text-brownyellow">
        Review
      </option>
      <option value="blocked" className="text-red">
        Blocked
      </option>
    </select>
  );
}

function UserDetailGrid({ user }: { user: AdminUserRow }) {
  const resumeHref = user.resume ? `${process.env.REACT_APP_SERVER_URL}/${user.resume}` : '';
  const fields = [
    { label: 'Title', value: dash(user.title) },
    { label: 'Country', value: dash(user.country?.name) },
    { label: 'State', value: dash(user.state?.name) },
    { label: 'City', value: dash(user.city?.name) },
    { label: 'Phone', value: dash(user.phoneNumber) },
  ];

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map(field => (
        <div key={field.label}>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-wl-muted">{field.label}</dt>
          <dd className="mt-0.5 text-sm text-wl-ink">{field.value}</dd>
        </div>
      ))}
      <div>
        <dt className="text-[11px] font-semibold uppercase tracking-wide text-wl-muted">Resume</dt>
        <dd className="mt-0.5 text-sm">
          {resumeHref ? (
            <a
              href={resumeHref}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-wl-brand underline hover:brightness-95"
              onClick={e => e.stopPropagation()}
            >
              resume
            </a>
          ) : (
            <span className="text-wl-ink">—</span>
          )}
        </dd>
      </div>
    </dl>
  );
}

export default function UserListTable({
  users,
  isReviewQueue,
  emptyMessage,
  onStatusChange,
  onApprove,
  onBlock,
  onManage,
  onImpersonate,
  onAudit,
}: {
  users: AdminUserRow[];
  isReviewQueue: boolean;
  emptyMessage: string;
  onStatusChange: (user: AdminUserRow, status: string) => void;
  onApprove: (user: AdminUserRow) => void;
  onBlock: (user: AdminUserRow) => void;
  onManage: (user: AdminUserRow) => void;
  onImpersonate: (user: AdminUserRow) => void;
  onAudit: (user: AdminUserRow) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setExpandedId(current => (current === id ? null : id));
  };

  if (users.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-wl-muted">{emptyMessage}</p>;
  }

  return (
    <div className="w-full px-4 pb-2">
      <div className="space-y-3 md:hidden">
        {users.map((u, idx) => {
          const id = userKey(u, idx);
          const expanded = expandedId === id;
          const detailsId = `user-details-mobile-${id}`;
          return (
            <article key={id} className="rounded-xl border border-wl-line bg-white p-3 shadow-sm">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={detailsId}
                  onClick={() => toggle(id)}
                  className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-wl-muted hover:bg-wl-pageAlt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/40"
                >
                  <ChevronRight
                    size={18}
                    className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
                    aria-hidden
                  />
                  <span className="sr-only">{expanded ? 'Hide details' : 'Show details'}</span>
                </button>
                <Avatar username={u.username || ''} image={u.image} />
                <div className="min-w-0 flex-1">
                  <UserIdentity user={u} />
                  <span className={`mt-1 inline-block text-[11px] font-semibold uppercase ${roleClass(u.role)}`}>
                    {dash(u.role)}
                  </span>
                </div>
                <UserActionsMenu
                  user={u}
                  isReviewQueue={isReviewQueue}
                  onApprove={() => onApprove(u)}
                  onBlock={() => onBlock(u)}
                  onManage={() => onManage(u)}
                  onImpersonate={() => onImpersonate(u)}
                  onAudit={() => onAudit(u)}
                />
              </div>
              <div className="mt-3 pl-11">
                <UserStatusSelect user={u} onChange={status => onStatusChange(u, status)} />
              </div>
              {expanded ? (
                <div id={detailsId} className="mt-3 border-t border-wl-line pt-3">
                  <UserDetailGrid user={u} />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <table className="hidden w-full table-fixed text-sm text-left md:table">
        <thead className="bg-wl-brandSoft text-xs uppercase text-wl-brand">
          <tr>
            <th className="w-10 px-2 py-3">
              <span className="sr-only">Details</span>
            </th>
            <th className="w-14 px-2 py-3">
              <span className="sr-only">Avatar</span>
            </th>
            <th className="px-3 py-3">Name</th>
            <th className="w-28 px-3 py-3">Role</th>
            <th className="w-36 px-3 py-3">Status</th>
            <th className="w-12 px-2 py-3 text-right">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((u, idx) => {
            const id = userKey(u, idx);
            const expanded = expandedId === id;
            const detailsId = `user-details-desktop-${id}`;
            return (
              <React.Fragment key={id}>
                <tr
                  className="cursor-pointer border-b border-wl-line text-wl-ink hover:bg-wl-pageAlt"
                  onClick={() => toggle(id)}
                >
                  <td className="px-1 py-2">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={detailsId}
                      onClick={e => {
                        e.stopPropagation();
                        toggle(id);
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-wl-muted hover:bg-wl-brandSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/40"
                    >
                      <ChevronRight
                        size={18}
                        className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
                        aria-hidden
                      />
                      <span className="sr-only">{expanded ? 'Hide details' : 'Show details'}</span>
                    </button>
                  </td>
                  <td className="px-2 py-2">
                    <Avatar username={u.username || ''} image={u.image} />
                  </td>
                  <td className="px-3 py-2">
                    <UserIdentity user={u} />
                  </td>
                  <td className={`px-3 py-2 text-sm uppercase ${roleClass(u.role)}`}>{dash(u.role)}</td>
                  <td className="px-3 py-2">
                    <UserStatusSelect user={u} onChange={status => onStatusChange(u, status)} />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <UserActionsMenu
                      user={u}
                      isReviewQueue={isReviewQueue}
                      onApprove={() => onApprove(u)}
                      onBlock={() => onBlock(u)}
                      onManage={() => onManage(u)}
                      onImpersonate={() => onImpersonate(u)}
                      onAudit={() => onAudit(u)}
                    />
                  </td>
                </tr>
                {expanded ? (
                  <tr className="border-b border-wl-line bg-wl-pageAlt/60">
                    <td colSpan={6} className="px-4 py-3" id={detailsId}>
                      <UserDetailGrid user={u} />
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
