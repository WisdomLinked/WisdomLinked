import React, { useCallback, useEffect, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import { useDispatch } from 'react-redux';
import { getMySeatRequests, paySeminarSeatRequest } from '../../api/api';
import { updateMe } from '../../actions/authActions';
import StudentBookingCheckout, { completeStudentBookingFromStorage } from './StudentBookingCheckout';
import { seatWalletOption } from '../../utils/seatCheckoutOptions';

export default function SeminarInvitations({ userId }: { userId?: string }) {
  const dispatch = useDispatch();
  const [requests, setRequests] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [recovering, setRecovering] = useState(false);
  const recovery = useRef<Promise<Awaited<ReturnType<typeof completeStudentBookingFromStorage>>> | null>(null);

  const load = useCallback(async () => {
    const res: any = await getMySeatRequests();
    if (!Array.isArray(res?.result)) throw new Error('Could not load seminar invitations.');
    return res.result;
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    load().then(rows => { if (!cancelled) setRequests(rows); })
      .catch(() => { if (!cancelled) setError('Could not load seminar invitations. Please refresh to try again.'); });
    return () => { cancelled = true; };
  }, [userId, load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const intent = params.get('payment_intent');
    if (!userId || params.get('seminar_invitation') !== '1' || !intent) return;
    if (!['succeeded', 'pending'].includes(params.get('redirect_status') || '')) {
      setError('Payment was not completed. You can try accepting the invitation again.');
      return;
    }
    // Restrict recovery to this flow; never complete an unrelated stored booking.
    try {
      if (JSON.parse(localStorage.getItem('pendingDetails') || 'null')?.kind !== 'pay-seat-request') return;
    } catch { return; }
    let cancelled = false;
    setRecovering(true);
    recovery.current ??= completeStudentBookingFromStorage(intent);
    recovery.current.then(async result => {
      if (cancelled) return;
      if (!result.ok) {
        setError(`${result.error} Refresh this page to retry confirming your seat.`);
        return;
      }
      setNotice('Your seminar seat is confirmed.');
      dispatch(updateMe() as any);
      const rows = await load();
      if (cancelled) return;
      setRequests(rows);
      ['payment_intent', 'payment_intent_client_secret', 'redirect_status', 'seminar_invitation'].forEach(key => params.delete(key));
      const query = params.toString();
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    }).catch(() => {
      if (!cancelled) setError('Could not confirm your seminar seat. Refresh this page to retry.');
    }).finally(() => { if (!cancelled) setRecovering(false); });
    return () => { cancelled = true; };
  }, [userId, dispatch, load]);

  const pay = async (paymentIntent: string) => {
    if (!selected) return;
    setError('');
    try {
      const res: any = await paySeminarSeatRequest({ requestId: String(selected._id), payment_intent: paymentIntent });
      if (!res || res.status === 'FAIL' || res.error) {
        setError(res?.error || 'Could not confirm your seminar seat. Please try again.');
        return;
      }
      localStorage.removeItem('pendingDetails');
      setRequests(prev => prev.filter(r => String(r._id) !== String(selected._id)));
      setSelected(null);
      setNotice('Your seminar seat is confirmed.');
      dispatch(updateMe() as any);
    } catch {
      setError('Could not confirm your seminar seat. Please try again.');
    }
  };

  const invitations = requests.filter(r => r.origin === 'host' && r.status === 'awaiting_payment'
    && r.groupChat && (!r.paymentDeadline || new Date(r.paymentDeadline).getTime() > Date.now()));
  if (!invitations.length && !error && !notice && !recovering) return null;
  const returnUrl = new URL(window.location.pathname, window.location.origin);
  returnUrl.searchParams.set('seminar_invitation', '1');

  return <section aria-label="Seminar invitations" className="space-y-3">
    <h2 className="text-lg font-semibold text-slate-900">Invitations to seminars</h2>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
    {recovering && <p role="status">Confirming your seminar seat…</p>}
    {invitations.map(r => <div key={r._id} className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold">{r.groupChat.name}</h3>
      <p className="text-sm text-slate-600">{r.groupChat.admin?.username || 'The host'} invited you to attend.</p>
      {r.groupChat.start && <p className="text-sm text-slate-600">{new Date(r.groupChat.start).toLocaleString()}</p>}
      {r.paymentDeadline && <p className="text-sm text-slate-600">Respond by {new Date(r.paymentDeadline).toLocaleString()}</p>}
      <p className="my-2 text-sm">Nothing is charged until you accept and pay. You can leave the invitation to expire.</p>
      <button type="button" disabled={recovering} onClick={() => { setError(''); setSelected(r); }}
        className="rounded-lg bg-[#234C6A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        Accept and pay {new Intl.NumberFormat(undefined, { style: 'currency', currency: r.currency || 'USD' }).format(Number(r.amount) / 100)}
      </button>
    </div>)}
    {selected && <Dialog open onClose={() => setSelected(null)} aria-label="Accept seminar invitation" maxWidth="sm" fullWidth>
      <div className="bg-white p-4">
        <h3 className="mb-3 font-semibold">{selected.groupChat.name}</h3>
        {error && <p role="alert" className="mb-3 text-sm text-rose-700">{error}</p>}
        <StudentBookingCheckout key={selected._id} type="Seminar seat" price={Number(selected.amount) / 100}
          returnUrl={returnUrl.toString()} walletOption={seatWalletOption('host')}
          policyNotice={{
            message: 'Paying accepts this invitation immediately. It cannot be cancelled and the payment is not refundable.',
            acknowledgeLabel: 'I understand this payment is non-refundable.',
          }}
          pendingDetails={{ kind: 'pay-seat-request', requestId: String(selected._id), groupChatId: String(selected.groupChat._id), price: Number(selected.amount) / 100, name: selected.groupChat.name }}
          onPaymentSuccess={pay} onCancel={() => setSelected(null)} cancelLabel="Back" />
      </div>
    </Dialog>}
  </section>;
}
