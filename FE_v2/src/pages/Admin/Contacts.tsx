import { useState, useEffect, useCallback } from "react";
import { contactsApi, Contact } from "@/api/adminApi";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import {
  Search,
  Mail,
  MailOpen,
  Trash2,
  Inbox,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type ReadFilter = "" | "false" | "true";

function parseReadFilter(v: string): ReadFilter {
  if (v === "false" || v === "true") return v;
  return "";
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Stats {
  total: number;
  unread: number;
  read: number;
}

export function AdminContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [readFilter, setReadFilter] = useState<ReadFilter>("");
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [stats, setStats] = useState<Stats>({ total: 0, unread: 0, read: 0 });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      const isRead = readFilter === "" ? undefined : readFilter === "true";
      const response = await contactsApi.list({
        search: search || undefined,
        isRead,
        page: pagination.page,
        limit: pagination.limit,
      });
      setContacts(response.items);
      setPagination((p) => ({
        ...p,
        total: response.pagination.total,
        totalPages: response.pagination.totalPages,
      }));
    } catch (error) {
      console.error("Failed to fetch contacts:", error);
    } finally {
      setLoading(false);
    }
  }, [search, readFilter, pagination.page, pagination.limit]);

  const fetchStats = useCallback(async () => {
    try {
      const [all, unread] = await Promise.all([
        contactsApi.list({ limit: 1 }),
        contactsApi.list({ limit: 1, isRead: false }),
      ]);
      setStats({
        total: all.pagination.total,
        unread: unread.pagination.total,
        read: all.pagination.total - unread.pagination.total,
      });
    } catch (error) {
      console.error("Failed to fetch contact stats:", error);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleMarkRead = async (id: string) => {
    try {
      await contactsApi.markRead(id);
      fetchContacts();
      fetchStats();
      if (window.toast) {
        window.toast({ title: "Success", description: "Marked as read" });
      }
    } catch (error) {
      console.error("Failed to mark contact as read:", error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await contactsApi.delete(id);
      setConfirmDeleteId(null);
      fetchContacts();
      fetchStats();
      if (window.toast) {
        window.toast({ title: "Success", description: "Contact deleted" });
      }
    } catch (error) {
      console.error("Failed to delete contact:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Contact Submissions</h1>
        <p className="text-muted-foreground mt-1">
          View and manage contact form submissions
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              Total Submissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Unread
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unread}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <MailOpen className="h-4 w-4" />
              Read
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.read}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search &amp; Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={readFilter}
              onChange={(e) => setReadFilter(parseReadFilter(e.target.value))}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="">All</option>
              <option value="false">Unread</option>
              <option value="true">Read</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Contacts ({pagination.total})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {contacts.map((contact) => (
                <div key={contact.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{contact.name}</p>
                        <span
                          className={`px-2 py-0.5 text-xs rounded shrink-0 ${
                            contact.isRead
                              ? "bg-muted text-muted-foreground"
                              : "bg-blue-500/10 text-blue-500"
                          }`}
                        >
                          {contact.isRead ? "Read" : "Unread"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {contact.email}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(contact.createdAt).toLocaleString()}
                      </p>
                      {expandedId === contact.id && (
                        <p className="text-sm mt-3 p-3 bg-muted/50 rounded">
                          {contact.message}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setExpandedId(
                            expandedId === contact.id ? null : contact.id,
                          )
                        }
                      >
                        {expandedId === contact.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                      {!contact.isRead && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMarkRead(contact.id)}
                        >
                          <MailOpen className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-500 hover:text-red-500"
                        onClick={() => setConfirmDeleteId(contact.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {confirmDeleteId === contact.id && (
                    <div className="mt-3 p-3 border rounded bg-red-500/5 border-red-500/20">
                      <p className="text-sm font-medium text-red-500 mb-2">
                        Delete this contact?
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(contact.id)}
                        >
                          Delete
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {contacts.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No contacts found
                </div>
              )}
            </div>

            {pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  disabled={pagination.page === 1}
                  onClick={() =>
                    setPagination((p) => ({ ...p, page: p.page - 1 }))
                  }
                >
                  Previous
                </Button>
                <span className="px-4 py-2">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() =>
                    setPagination((p) => ({ ...p, page: p.page + 1 }))
                  }
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
