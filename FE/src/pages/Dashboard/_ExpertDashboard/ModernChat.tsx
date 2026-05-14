import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  Search,
  Users,
  MessageCircle,
  Plus,
  X,
  CheckCircle2,
} from 'lucide-react';
import { useAppSelector } from '../../../store';
import {
  createCommunityChat,
  getAllCommunityChats,
  joinCommunityChat,
  doFilterCustomers,
  joinPrivateChat,
} from '../../../api/api';
import { showAlert } from '../../../actions/alertActions';
import { updateMe } from '../../../actions/authActions';
import { setChosenChatDetails, setChosenGroupChatDetails } from '../../../actions/chatActions';
import Messenger from '../Messenger/Messenger';

type Tab = 'community' | 'private';

export default function ModernChat({ videoChaton }: { videoChaton: boolean }) {
  const dispatch = useDispatch();
  const { auth: { userDetails } } = useAppSelector((s) => s);

  const [tab, setTab] = useState<Tab>('community');
  const [query, setQuery] = useState('');

  const [communityChats, setCommunityChats] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newOpenToAll, setNewOpenToAll] = useState(true);
  const [creating, setCreating] = useState(false);

  const refreshCommunity = async () => {
    setLoading(true);
    try {
      const res: any = await getAllCommunityChats();
      if (res?.status === 'SUCCESS' && Array.isArray(res.chats)) {
        setCommunityChats(res.chats);
      } else {
        setCommunityChats([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshCustomers = async (q: string) => {
    setLoading(true);
    try {
      const res: any = await doFilterCustomers({
        username: q,
        keywords: [],
        services: [],
        sortBy: 'Name in ASC',
      });
      setCustomers(Array.isArray(res?.result) ? res.result : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshCommunity();
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (tab === 'private') {
        refreshCustomers(query);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [tab, query]);

  const filteredCommunity = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return communityChats;
    return communityChats.filter((c: any) => {
      return (
        String(c.name || '').toLowerCase().includes(q) ||
        String(c.description || '').toLowerCase().includes(q)
      );
    });
  }, [communityChats, query]);

  const onCreateCommunity = async () => {
    if (!newName.trim()) {
      dispatch(showAlert('Community name is required'));
      return;
    }
    setCreating(true);
    try {
      const res: any = await createCommunityChat({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        isOpenToAll: newOpenToAll,
      });
      if (res?.status === 'SUCCESS') {
        dispatch(showAlert('Community created'));
        setCreateOpen(false);
        setNewName('');
        setNewDescription('');
        setNewOpenToAll(true);
        dispatch(updateMe() as any);
        await refreshCommunity();
      } else {
        dispatch(showAlert(res?.error || 'Failed to create community'));
      }
    } finally {
      setCreating(false);
    }
  };

  const onJoinCommunity = async (chat: any) => {
    try {
      const res: any = await joinCommunityChat(chat._id);
      if (res?.status === 'SUCCESS') {
        dispatch(showAlert('Joined community'));
        dispatch(updateMe() as any);
      } else {
        dispatch(showAlert(res?.error || 'Failed to join'));
      }
    } finally {
      // attempt to open in Messenger by setting chosen group chat
      dispatch(setChosenGroupChatDetails({
        ...(chat || {}),
        groupId: chat?._id,
        groupName: chat?.name,
      } as any));
    }
  };

  const onOpenPrivateChat = async (customer: any) => {
    const otherUserId = customer?._id;
    if (!otherUserId) return;
    const response: any = await joinPrivateChat(otherUserId);
    const payload = response?.data ?? response;
    const user = payload?.user ?? payload;
    const other = payload?.otherUser;

    if (user) {
      dispatch({ type: 'updateUserDetails', payload: user });
    }
    dispatch(
      setChosenChatDetails({
        userId: String(otherUserId),
        username: other?.username ?? customer?.username,
        image: other?.image ?? customer?.image,
        peerRole:
          String(other?.role || customer?.role || '')
            .toLowerCase()
            .trim() || undefined,
      }),
    );
  };

  return (
    <div className="h-[calc(100vh-56px)] min-h-0 bg-wl-page">
      <div className="flex h-full min-h-0">
        {/* Left panel */}
        <aside className="hidden min-h-0 md:flex md:w-80 lg:w-96 flex-col border-r border-slate-200 bg-white">
          <div className="px-4 pt-4 pb-3 border-b border-slate-200">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Chats
              </p>
              {String(userDetails?.role).toLowerCase() === 'expert' && tab === 'community' ? (
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#234C6A] px-3 py-1.5 text-[11px] font-semibold text-white hover:brightness-95"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New community
                </button>
              ) : null}
            </div>

            <div className="mt-3 inline-flex rounded-full bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setTab('community')}
                className={`px-3 py-1.5 text-[11px] font-medium rounded-full transition ${
                  tab === 'community' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Community
              </button>
              <button
                type="button"
                onClick={() => setTab('private')}
                className={`px-3 py-1.5 text-[11px] font-medium rounded-full transition ${
                  tab === 'private' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Private
              </button>
            </div>

            <div className="mt-3 rounded-lg bg-slate-100 px-3 py-2 flex items-center gap-2 text-xs text-slate-500">
              <Search className="h-3.5 w-3.5 text-slate-500 shrink-0" aria-hidden />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={tab === 'community' ? 'Search communities…' : 'Search customers…'}
                className="flex-1 min-w-0 bg-transparent outline-none text-xs text-slate-700 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {loading ? (
              <div className="px-2 py-3 text-[11px] text-slate-500">Loading…</div>
            ) : tab === 'community' ? (
              filteredCommunity.length ? (
                filteredCommunity.map((c: any) => (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => onJoinCommunity(c)}
                    className="w-full rounded-xl px-3 py-2 text-left text-xs flex items-start gap-2 transition-colors hover:bg-slate-100 text-slate-700"
                  >
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-[#234C6A] text-[10px]">
                      <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate font-semibold text-[11px]">{c.name}</span>
                      <span className="mt-0.5 block line-clamp-2 text-[10px] text-slate-500">
                        {c.description || 'Community chat'}
                      </span>
                    </span>
                  </button>
                ))
              ) : (
                <div className="px-2 py-3 text-[11px] text-slate-500">No community chats.</div>
              )
            ) : (
              customers.length ? (
                customers.map((u: any) => (
                  <button
                    key={u._id}
                    type="button"
                    onClick={() => onOpenPrivateChat(u)}
                    className="w-full rounded-xl px-3 py-2 text-left text-xs flex items-start gap-2 transition-colors hover:bg-slate-100 text-slate-700"
                  >
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#e8f0f8] text-[#234c6a] text-[10px] font-bold">
                      {String(u.username || u.email || 'U')
                        .split(' ')
                        .map((p: string) => p[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate font-semibold text-[11px]">{u.username || u.email}</span>
                      <span className="mt-0.5 block truncate text-[10px] text-slate-500">{u.email}</span>
                    </span>
                    <span className="mt-0.5 text-[10px] text-slate-400">
                      <MessageCircle className="h-3.5 w-3.5" />
                    </span>
                  </button>
                ))
              ) : (
                <div className="px-2 py-3 text-[11px] text-slate-500">
                  {query.trim() ? 'No customers match your search.' : 'Search for a customer to start chatting.'}
                </div>
              )
            )}
          </div>
        </aside>

        {/* Right panel: existing real chat */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-wl-page">
          <Messenger videoChaton={videoChaton} theme="light" />
        </main>
      </div>

      {/* Create community modal */}
      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Create community</h2>
                <p className="mt-1 text-sm text-slate-500">Experts can create and manage community rooms.</p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 text-slate-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs font-semibold text-slate-600 mb-1">Name</div>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#234C6A]/60 focus:border-[#234C6A]"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Resume Clinic"
                />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-600 mb-1">Description (optional)</div>
                <textarea
                  className="w-full min-h-[90px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#234C6A]/60 focus:border-[#234C6A]"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What is this community for?"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={newOpenToAll}
                  onChange={(e) => setNewOpenToAll(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#234C6A] focus:ring-[#234C6A]"
                />
                Open to all users
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={onCreateCommunity}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#234C6A] text-xs font-semibold text-white hover:brightness-95 disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

