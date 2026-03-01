import { useState, useEffect, useCallback } from "react";
import {
  groupChatsApi,
  type GroupChat,
  type CreateGroupChatData,
} from "@/api/groupChatsApi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Plus, Users, Calendar, Clock, DollarSign } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

type LoadState = "loading" | "success" | "error";
type SaveState = "idle" | "saving";

interface SeminarFormData {
  name: string;
  description: string;
  startDate: Date | undefined;
  durationMinutes: string;
  price: string;
}

const EMPTY_FORM: SeminarFormData = {
  name: "",
  description: "",
  startDate: undefined,
  durationMinutes: "60",
  price: "",
};

// ── Pure helpers ──────────────────────────────────────────────────────────

function statusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "pending":
      return "secondary";
    case "cancelled":
      return "destructive";
    case "completed":
      return "outline";
    default:
      return "outline";
  }
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function ExpertSeminars() {
  const [seminars, setSeminars] = useState<GroupChat[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState<SeminarFormData>(EMPTY_FORM);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchSeminars = useCallback(async () => {
    try {
      setLoadState("loading");
      const res = await groupChatsApi.listGroupChats({
        type: "seminar",
        mine: true,
        page,
        limit: 9,
      });
      setSeminars(res.groupChats);
      setTotalPages(res.totalPages);
      setLoadState("success");
    } catch (err) {
      console.error("Failed to load seminars:", err);
      setLoadState("error");
    }
  }, [page]);

  useEffect(() => {
    fetchSeminars();
  }, [fetchSeminars]);

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      window.toast({
        title: "Validation error",
        description: "Seminar name is required.",
        variant: "destructive",
      });
      return;
    }
    try {
      setSaveState("saving");
      const durationNum = Number(formData.durationMinutes);
      const priceNum = Number(formData.price);
      const data: CreateGroupChatData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        type: "seminar",
        start: formData.startDate
          ? formData.startDate.toISOString()
          : undefined,
        duration:
          formData.durationMinutes !== "" && !isNaN(durationNum)
            ? durationNum
            : undefined,
        price:
          formData.price !== "" && !isNaN(priceNum) ? priceNum : undefined,
      };
      await groupChatsApi.createGroupChat(data);
      setCreateOpen(false);
      setFormData(EMPTY_FORM);
      setSaveState("idle");
      window.toast({
        title: "Seminar created",
        description: "Your seminar has been created successfully.",
      });
      await fetchSeminars();
    } catch (err) {
      console.error("Failed to create seminar:", err);
      setSaveState("idle");
      window.toast({
        title: "Error",
        description: "Failed to create seminar.",
        variant: "destructive",
      });
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setCreateOpen(open);
    if (!open) setFormData(EMPTY_FORM);
  };

  const handleCancel = async (id: string) => {
    try {
      setCancellingId(id);
      await groupChatsApi.cancelGroupChat(id);
      window.toast({
        title: "Seminar cancelled",
        description: "The seminar has been cancelled.",
      });
      await fetchSeminars();
    } catch (err) {
      console.error("Failed to cancel seminar:", err);
      window.toast({
        title: "Error",
        description: "Failed to cancel seminar.",
        variant: "destructive",
      });
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Manage Seminars</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage your seminars
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Create Seminar
        </Button>
      </div>

      {/* ── Create Dialog ── */}
      <Dialog open={createOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Seminar</DialogTitle>
            <DialogDescription>
              Set up a new seminar for your customers
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="seminar-name">Name *</Label>
              <Input
                id="seminar-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Advanced React Workshop"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seminar-description">Description</Label>
              <Textarea
                id="seminar-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="What will participants learn?"
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <DatePicker
                value={formData.startDate}
                onChange={(date) =>
                  setFormData((f) => ({ ...f, startDate: date }))
                }
                placeholder="Pick a start date"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="seminar-duration">Duration (min)</Label>
                <Input
                  id="seminar-duration"
                  type="number"
                  min={1}
                  value={formData.durationMinutes}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      durationMinutes: e.target.value,
                    }))
                  }
                  placeholder="60"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seminar-price">Price (USD)</Label>
                <Input
                  id="seminar-price"
                  type="number"
                  min={0}
                  value={formData.price}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, price: e.target.value }))
                  }
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saveState === "saving"}
            >
              {saveState === "saving" ? "Creating…" : "Create Seminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Seminars list ── */}
      {loadState === "loading" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : loadState === "error" ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>Failed to load seminars.</p>
          <Button variant="outline" className="mt-4" onClick={fetchSeminars}>
            Retry
          </Button>
        </div>
      ) : seminars.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">
              You haven&apos;t created any seminars yet.
            </p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Create Your First Seminar
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {seminars.map((seminar) => (
              <Card key={seminar._id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">
                      {seminar.name}
                    </CardTitle>
                    <Badge variant={statusVariant(seminar.status)}>
                      {seminar.status}
                    </Badge>
                  </div>
                  {seminar.description && (
                    <CardDescription className="line-clamp-2">
                      {seminar.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 shrink-0" />
                      {formatDate(seminar.start)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 shrink-0" />
                      {seminar.duration ? `${seminar.duration} min` : "—"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3 shrink-0" />
                      {seminar.participants.length} participants
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3 shrink-0" />
                      {seminar.price ? `${seminar.price}` : "Free"}
                    </span>
                  </div>
                </CardContent>

                {seminar.status !== "cancelled" &&
                  seminar.status !== "completed" && (
                    <CardFooter className="pt-0">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="w-full"
                            disabled={cancellingId === seminar._id}
                          >
                            {cancellingId === seminar._id
                              ? "Cancelling…"
                              : "Cancel Seminar"}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Cancel &ldquo;{seminar.name}&rdquo;?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. All enrolled
                              participants will be notified.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep Seminar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleCancel(seminar._id)}
                            >
                              Yes, Cancel
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </CardFooter>
                  )}
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
