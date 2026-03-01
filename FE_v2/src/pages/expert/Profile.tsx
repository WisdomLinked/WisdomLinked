import { useState, useEffect, useCallback, useRef } from "react";
import { profileApi, type UserProfile, type UpdateProfileData } from "@/api/profileApi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Upload, FileText } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

type LoadState = "loading" | "success" | "error";
type SaveState = "idle" | "saving";

// ── Page ──────────────────────────────────────────────────────────────────

export default function ExpertProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // Editable form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");

  // Upload state
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [resumeUploading, setResumeUploading] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  const loadProfile = useCallback(async () => {
    try {
      setLoadState("loading");
      const res = await profileApi.getProfile();
      setProfile(res.user);
      setTitle(res.user.title ?? "");
      setDescription(res.user.description ?? "");
      setHourlyRate(res.user.price.length > 0 ? String(res.user.price[0]) : "");
      setLoadState("success");
    } catch (err) {
      console.error("Failed to load profile:", err);
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSave = async () => {
    try {
      setSaveState("saving");
      const rateNum = Number(hourlyRate);
      const data: UpdateProfileData = {
        title: title || undefined,
        description: description || undefined,
        price:
          hourlyRate !== "" && !isNaN(rateNum) ? [rateNum] : undefined,
      };
      const res = await profileApi.updateProfile(data);
      setProfile(res.user);
      setSaveState("idle");
      window.toast({
        title: "Profile updated",
        description: "Your profile has been saved.",
      });
    } catch (err) {
      console.error("Failed to save profile:", err);
      setSaveState("idle");
      window.toast({
        title: "Error",
        description: "Failed to save profile.",
        variant: "destructive",
      });
    }
  };

  if (loadState === "loading") {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-64" />
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-32" />
            <Skeleton className="h-10" />
          </div>
        </div>
      </div>
    );
  }

  if (loadState === "error" || profile === null) {
    return (
      <div className="p-6">
        <div className="text-center py-16 text-muted-foreground">
          <p>Failed to load profile.</p>
          <Button variant="outline" className="mt-4" onClick={loadProfile}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const initials = profile.username.slice(0, 2).toUpperCase();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-muted-foreground mt-1">
          Manage your expert profile and visibility
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* ── Left column: avatar + uploads ── */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 flex flex-col items-center gap-4">
              <Avatar className="h-24 w-24">
                {profile.image ? (
                  <AvatarImage
                    src={profile.image}
                    alt={profile.username}
                  />
                ) : null}
                <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
              </Avatar>
              <div className="text-center">
                <p className="font-semibold">{profile.username}</p>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
                <Badge className="mt-2" variant="secondary">
                  {profile.role}
                </Badge>
              </div>

              {/* Hidden avatar input */}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    setAvatarUploading(true);
                    const res = await profileApi.uploadAvatar(file);
                    setProfile((prev) =>
                      prev ? { ...prev, image: res.imageUrl } : prev
                    );
                    window.toast({
                      title: "Avatar updated",
                      description: "Profile picture changed.",
                    });
                  } catch (err) {
                    console.error("Failed to upload avatar:", err);
                    window.toast({
                      title: "Error",
                      description: "Failed to upload avatar.",
                      variant: "destructive",
                    });
                  } finally {
                    setAvatarUploading(false);
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={avatarUploading}
                onClick={() => avatarInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {avatarUploading ? "Uploading…" : "Change Photo"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Resume
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profile.resume ? (
                <a
                  href={profile.resume}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline truncate block"
                >
                  View current resume
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No resume uploaded
                </p>
              )}

              {/* Hidden resume input */}
              <input
                ref={resumeInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    setResumeUploading(true);
                    const res = await profileApi.uploadResume(file);
                    setProfile((prev) =>
                      prev ? { ...prev, resume: res.resumeUrl } : prev
                    );
                    window.toast({
                      title: "Resume uploaded",
                      description: "Resume has been saved.",
                    });
                  } catch (err) {
                    console.error("Failed to upload resume:", err);
                    window.toast({
                      title: "Error",
                      description: "Failed to upload resume.",
                      variant: "destructive",
                    });
                  } finally {
                    setResumeUploading(false);
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={resumeUploading}
                onClick={() => resumeInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {resumeUploading ? "Uploading…" : "Upload Resume"}
              </Button>
            </CardContent>
          </Card>

          {profile.keywords.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Specializations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {profile.keywords.map((kw) => (
                    <Badge key={kw._id} variant="outline">
                      {kw.name ?? kw._id}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right column: edit form ── */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your expert bio and rate
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title">Professional Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Senior Software Engineer"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Bio</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell customers about your expertise…"
                  className="min-h-[120px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hourlyRate">Hourly Rate (USD)</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  min={0}
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="e.g. 50"
                />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Rating</span>
                  <p className="font-medium mt-1">
                    ⭐ {profile.rating.toFixed(1)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p className="font-medium mt-1 capitalize">
                    {profile.status}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Country</span>
                  <p className="font-medium mt-1">{profile.country ?? "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Timezone</span>
                  <p className="font-medium mt-1">{profile.timeZone ?? "—"}</p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={saveState === "saving"}
                >
                  {saveState === "saving" ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
