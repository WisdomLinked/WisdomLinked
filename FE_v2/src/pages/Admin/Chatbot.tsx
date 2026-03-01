import { useState, useEffect, useCallback } from "react";
import { chatbotApi, ChatBotQA } from "@/api/adminApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Search, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, MessageSquare, CheckCircle, XCircle } from "lucide-react";

type ActiveFilter = "" | "true" | "false";

function parseActiveFilter(v: string): ActiveFilter {
  if (v === "true" || v === "false") return v;
  return "";
}

interface EditState { question: string; answer: string; category: string }
interface NewQAState { question: string; answer: string; category: string }
interface Pagination { page: number; limit: number; total: number; totalPages: number }
interface Stats { total: number; active: number; inactive: number }

export function AdminChatbot() {
  const [items, setItems] = useState<ChatBotQA[]>([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("");
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, inactive: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({
    question: "",
    answer: "",
    category: "",
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQA, setNewQA] = useState<NewQAState>({
    question: "",
    answer: "",
    category: "",
  });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const isActive =
        activeFilter === "" ? undefined : activeFilter === "true";
      const response = await chatbotApi.list({
        search: search || undefined,
        isActive,
        page: pagination.page,
        limit: pagination.limit,
      });
      setItems(response.items);
      setPagination((p) => ({
        ...p,
        total: response.pagination.total,
        totalPages: response.pagination.totalPages,
      }));
    } catch (error) {
      console.error("Failed to fetch chatbot Q&As:", error);
    } finally {
      setLoading(false);
    }
  }, [search, activeFilter, pagination.page, pagination.limit]);

  const fetchStats = useCallback(async () => {
    try {
      const [all, active] = await Promise.all([
        chatbotApi.list({ limit: 1 }),
        chatbotApi.list({ limit: 1, isActive: true }),
      ]);
      setStats({
        total: all.pagination.total,
        active: active.pagination.total,
        inactive: all.pagination.total - active.pagination.total,
      });
    } catch (error) {
      console.error("Failed to fetch chatbot stats:", error);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleCreate = async () => {
    if (!newQA.question.trim() || !newQA.answer.trim()) {
      if (window.toast) {
        window.toast({
          title: "Error",
          description: "Question and answer are required",
          variant: "destructive",
        });
      }
      return;
    }
    try {
      await chatbotApi.create(newQA);
      setNewQA({ question: "", answer: "", category: "" });
      setShowAddForm(false);
      fetchItems();
      fetchStats();
      if (window.toast) {
        window.toast({ title: "Success", description: "Q&A created successfully" });
      }
    } catch (error) {
      console.error("Failed to create Q&A:", error);
    }
  };

  const handleStartEdit = (item: ChatBotQA) => {
    setEditingId(item.id);
    setEditState({
      question: item.question,
      answer: item.answer,
      category: item.category,
    });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await chatbotApi.update(id, editState);
      setEditingId(null);
      fetchItems();
      if (window.toast) {
        window.toast({ title: "Success", description: "Q&A updated successfully" });
      }
    } catch (error) {
      console.error("Failed to update Q&A:", error);
    }
  };

  const handleToggle = async (item: ChatBotQA) => {
    try {
      await chatbotApi.update(item.id, { isActive: !item.isActive });
      fetchItems();
      fetchStats();
      if (window.toast) {
        window.toast({
          title: "Success",
          description: `Q&A ${item.isActive ? "deactivated" : "activated"}`,
        });
      }
    } catch (error) {
      console.error("Failed to toggle Q&A:", error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await chatbotApi.delete(id);
      setConfirmDeleteId(null);
      fetchItems();
      fetchStats();
      if (window.toast) {
        window.toast({ title: "Success", description: "Q&A deleted" });
      }
    } catch (error) {
      console.error("Failed to delete Q&A:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Chatbot Q&amp;A Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage automated Q&amp;A entries for the chatbot
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Total Q&amp;As
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Active
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Inactive
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inactive}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Search &amp; Filter</CardTitle>
            <Button onClick={() => setShowAddForm((v) => !v)}>
              <Plus className="h-4 w-4 mr-2" />
              Add New Q&amp;A
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddForm && (
            <div className="border rounded-lg p-4 bg-muted/50 space-y-3">
              <p className="font-medium text-sm">New Q&amp;A Entry</p>
              <Input
                placeholder="Question"
                value={newQA.question}
                onChange={(e) =>
                  setNewQA((s) => ({ ...s, question: e.target.value }))
                }
              />
              <textarea
                placeholder="Answer"
                value={newQA.answer}
                onChange={(e) =>
                  setNewQA((s) => ({ ...s, answer: e.target.value }))
                }
                className="w-full px-3 py-2 border rounded-md bg-background text-sm min-h-[80px] resize-none"
              />
              <Input
                placeholder="Category (optional)"
                value={newQA.category}
                onChange={(e) =>
                  setNewQA((s) => ({ ...s, category: e.target.value }))
                }
              />
              <div className="flex gap-2">
                <Button onClick={handleCreate}>Create</Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search questions or answers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={activeFilter}
              onChange={(e) =>
                setActiveFilter(parseActiveFilter(e.target.value))
              }
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Q&amp;A Entries ({pagination.total})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="border rounded-lg p-4">
                  {editingId === item.id ? (
                    <div className="space-y-3">
                      <Input
                        value={editState.question}
                        onChange={(e) =>
                          setEditState((s) => ({
                            ...s,
                            question: e.target.value,
                          }))
                        }
                        placeholder="Question"
                      />
                      <textarea
                        value={editState.answer}
                        onChange={(e) =>
                          setEditState((s) => ({
                            ...s,
                            answer: e.target.value,
                          }))
                        }
                        placeholder="Answer"
                        className="w-full px-3 py-2 border rounded-md bg-background text-sm min-h-[80px] resize-none"
                      />
                      <Input
                        value={editState.category}
                        onChange={(e) =>
                          setEditState((s) => ({
                            ...s,
                            category: e.target.value,
                          }))
                        }
                        placeholder="Category"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(item.id)}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm truncate">
                            {item.question}
                          </p>
                          {item.category && (
                            <span className="px-2 py-0.5 text-xs rounded bg-primary/10 text-primary shrink-0">
                              {item.category}
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 text-xs rounded shrink-0 ${
                              item.isActive
                                ? "bg-green-500/10 text-green-500"
                                : "bg-red-500/10 text-red-500"
                            }`}
                          >
                            {item.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {item.answer}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Created:{" "}
                          {new Date(item.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartEdit(item)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggle(item)}
                        >
                          {item.isActive ? (
                            <ToggleRight className="h-4 w-4" />
                          ) : (
                            <ToggleLeft className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-500 hover:text-red-500"
                          onClick={() => setConfirmDeleteId(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {confirmDeleteId === item.id && (
                    <div className="mt-3 p-3 border rounded bg-red-500/5 border-red-500/20">
                      <p className="text-sm font-medium text-red-500 mb-2">
                        Delete this Q&amp;A?
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(item.id)}
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

              {items.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No Q&amp;A entries found
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
