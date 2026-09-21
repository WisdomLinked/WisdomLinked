import React, { useEffect, useMemo, useState } from 'react';
import { doGetContactedUs, sendEmailToUser } from '../api/api';
import SelectionWithCheckBox from './SelectionWithCheckBox';
import DatePickerField from './ui/DatePickerField';
import ClearableInput from './ui/ClearableInput';
import ContactRequestCard, { type ContactedUsItem } from './contactedUs/ContactRequestCard';
import { notify } from '../utils/notify';
import { usePendingContactRequestsCount } from '../hooks/usePendingContactRequestsCount';

const sortByOptions = [
  { value: 'name', label: 'Name' },
  { value: 'createdAt', label: 'Created at' },
];

type ContactTab = 'pending' | 'responded';

const PAGE_SIZE = 10;

export default function GetContactedUs() {
  const [contactedUsList, setContactedUsList] = useState<ContactedUsItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ContactTab>('pending');

  const [filterName, setFilterName] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [sortBy, setSortBy] = useState('name');

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [adminMessages, setAdminMessages] = useState<{ [key: string]: string }>({});
  const [sendErrors, setSendErrors] = useState<{ [key: string]: string }>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const { refresh: refreshPendingCount, decrement: decrementPendingCount } =
    usePendingContactRequestsCount();

  const pendingItems = useMemo(
    () => contactedUsList.filter(item => item.actioned !== 'Yes'),
    [contactedUsList],
  );
  const respondedItems = useMemo(
    () => contactedUsList.filter(item => item.actioned === 'Yes'),
    [contactedUsList],
  );
  const tabItems = activeTab === 'pending' ? pendingItems : respondedItems;
  const totalPages = Math.max(1, Math.ceil(tabItems.length / PAGE_SIZE));
  const pageItems = tabItems.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  const clearDateRange = () => {
    setDateFrom('');
    setDateTo('');
  };

  const fetchContactedUs = async () => {
    try {
      setIsLoading(true);
      const filters: Record<string, string> = { sortBy, sortOrder: 'asc' };
      if (filterName.trim()) filters.name = filterName.trim();
      if (filterEmail.trim()) filters.email = filterEmail.trim();
      if (dateFrom && dateTo && dateFrom <= dateTo) {
        filters.dateFrom = dateFrom;
        filters.dateTo = dateTo;
      }
      const res = await doGetContactedUs(filters);
      if (res && res.status === 'SUCCESS' && res.data) {
        setContactedUsList(res.data);
      } else {
        setContactedUsList([]);
      }
    } catch (error) {
      console.error(error);
      setContactedUsList([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(0);
    void fetchContactedUs();
  }, [filterName, filterEmail, dateFrom, dateTo, sortBy]);

  useEffect(() => {
    const last = Math.max(0, Math.ceil(tabItems.length / PAGE_SIZE) - 1);
    if (currentPage > last) setCurrentPage(last);
  }, [tabItems.length, currentPage]);

  const selectTab = (tab: ContactTab) => {
    setActiveTab(tab);
    setCurrentPage(0);
  };

  const handleSendEmail = async (id: string, email: string) => {
    const adminRawMessage = adminMessages[id] || '';
    if (!adminRawMessage.trim()) {
      const msg = 'Please enter a message before sending.';
      setSendErrors(prev => ({ ...prev, [id]: msg }));
      notify.error(msg);
      return;
    }
    setSendingId(id);
    setSendErrors(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const res = await sendEmailToUser(email, adminRawMessage, id);
      if (res && res.status === 'SUCCESS') {
        const wasPending =
          contactedUsList.find(item => item._id === id)?.actioned !== 'Yes';
        setContactedUsList(prev =>
          prev.map(item => (item._id === id ? { ...item, actioned: res.actioned || 'Yes' } : item)),
        );
        setAdminMessages(prev => ({ ...prev, [id]: '' }));
        notify.success('Email sent. Request marked as responded.');
        if (wasPending) decrementPendingCount();
        void refreshPendingCount();
      } else {
        const msg =
          typeof res?.message === 'string' ? res.message : 'Failed to send email.';
        setSendErrors(prev => ({ ...prev, [id]: msg }));
        notify.error(msg);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      const msg = 'An error occurred while sending email.';
      setSendErrors(prev => ({ ...prev, [id]: msg }));
      notify.error(msg);
    } finally {
      setSendingId(null);
    }
  };

  const emptyCopy =
    activeTab === 'pending' ? 'No requests need a response.' : 'No responded requests.';

  return (
    <div className="w-full min-h-full overflow-y-auto bg-wl-page px-[18px] pt-10 pb-10 text-wl-ink">
      <div className="mx-auto w-full max-w-[1200px]">
        <h2 className="mb-8 text-center text-2xl font-semibold text-wl-brand">
          Contacted Us Records (Admin View)
        </h2>

        <div className="mb-8 flex flex-wrap items-end justify-center gap-x-4 gap-y-5">
          <div className="flex min-w-0 w-full flex-1 basis-[260px] max-w-xl flex-col">
            <label className="mb-1 text-center text-sm text-wl-muted">Search by name</label>
            <ClearableInput
              placeholder="Type a name"
              value={filterName}
              onChange={e => setFilterName(e.target.value)}
            />
          </div>

          <div className="flex min-w-0 w-full flex-1 basis-[260px] max-w-xl flex-col">
            <label className="mb-1 text-center text-sm text-wl-muted">Search by email</label>
            <ClearableInput
              placeholder="Type an email"
              value={filterEmail}
              onChange={e => setFilterEmail(e.target.value)}
            />
          </div>

          <div className="flex min-w-0 w-full flex-1 basis-[280px] max-w-xl flex-col">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm text-wl-muted">Date range</span>
              {dateFrom || dateTo ? (
                <button
                  type="button"
                  className="rounded-lg bg-wl-brand px-2 py-1 text-xs font-medium text-white hover:brightness-95"
                  onClick={clearDateRange}
                >
                  Clear
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="contact-date-from" className="mb-1 block text-[12px] text-wl-muted">
                  From
                </label>
                <DatePickerField
                  id="contact-date-from"
                  size="filter"
                  value={dateFrom}
                  onChange={next => {
                    setDateFrom(next);
                    if (dateTo && next > dateTo) setDateTo('');
                  }}
                  placeholder="From"
                />
              </div>
              <div>
                <label htmlFor="contact-date-to" className="mb-1 block text-[12px] text-wl-muted">
                  To
                </label>
                <DatePickerField
                  id="contact-date-to"
                  size="filter"
                  value={dateTo}
                  onChange={setDateTo}
                  min={dateFrom || undefined}
                  placeholder="To"
                />
              </div>
            </div>
          </div>

          <div className="flex min-w-0 w-full flex-1 basis-[220px] max-w-sm flex-col">
            <label className="mb-1 text-center text-sm text-wl-muted">Sort by</label>
            <SelectionWithCheckBox
              options={sortByOptions}
              selectedOptions={sortByOptions.find(o => o.value === sortBy) ?? sortByOptions[0]}
              set_selectedOptions={(opt: { value: string }) => setSortBy(opt.value)}
              placeholder="Sort field"
              isMulti={false}
            />
          </div>
        </div>

        {isLoading ? (
          <p className="text-center text-wl-muted">Loading contact requests...</p>
        ) : (
          <div className="mx-auto max-w-4xl">
            <div className="mb-4 grid grid-cols-2 overflow-hidden rounded-xl border border-wl-line bg-wl-card shadow-sm">
              <button
                type="button"
                aria-pressed={activeTab === 'pending'}
                onClick={() => selectTab('pending')}
                className={`px-3 py-2.5 text-sm font-medium ${
                  activeTab === 'pending'
                    ? 'bg-wl-brand text-white'
                    : 'bg-wl-pageAlt text-wl-ink hover:border-wl-brand/30'
                }`}
              >
                Needs Response ({pendingItems.length})
              </button>
              <button
                type="button"
                aria-pressed={activeTab === 'responded'}
                onClick={() => selectTab('responded')}
                className={`px-3 py-2.5 text-sm font-medium ${
                  activeTab === 'responded'
                    ? 'bg-wl-brand text-white'
                    : 'bg-wl-pageAlt text-wl-ink hover:bg-wl-brandSoft'
                }`}
              >
                Responded ({respondedItems.length})
              </button>
            </div>

            {tabItems.length === 0 ? (
              <p className="py-10 text-center text-wl-muted">{emptyCopy}</p>
            ) : (
              <>
                <div className="mb-3 flex flex-col gap-2 text-sm text-wl-muted sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Showing {currentPage * PAGE_SIZE + 1}–
                    {Math.min((currentPage + 1) * PAGE_SIZE, tabItems.length)} of {tabItems.length}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={currentPage <= 0}
                      onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                      className="rounded-lg border border-wl-line px-3 py-1 hover:bg-wl-pageAlt disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages - 1}
                      onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                      className="rounded-lg border border-wl-line px-3 py-1 hover:bg-wl-pageAlt disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
                <div className="space-y-4">
                  {pageItems.map(item => (
                    <ContactRequestCard
                      key={item._id}
                      item={item}
                      message={adminMessages[item._id] || ''}
                      error={sendErrors[item._id]}
                      sending={sendingId === item._id}
                      onMessageChange={value => {
                        setAdminMessages(prev => ({ ...prev, [item._id]: value }));
                        setSendErrors(prev => {
                          if (!prev[item._id]) return prev;
                          const next = { ...prev };
                          delete next[item._id];
                          return next;
                        });
                      }}
                      onSendEmail={() => handleSendEmail(item._id, item.email)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
