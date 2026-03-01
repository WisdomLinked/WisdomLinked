import { useEffect, useCallback, useState, useRef } from "react";
import { Camera, Save } from "lucide-react";

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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { PhoneInput } from "@/components/ui/phone-input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

// ── Types ──────────────────────────────────────────────────────────────────

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; profile: UserProfile };

interface FormState {
  description: string;
  phoneNumber: string;
  country: string;
  city: string;
  timeZone: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function profileToForm(profile: UserProfile): FormState {
  return {
    description: profile.description ?? "",
    phoneNumber: profile.phoneNumber ?? "",
    country: profile.country ?? "",
    city: profile.city ?? "",
    timeZone: profile.timeZone ?? "",
  };
}

// ── Component ──────────────────────────────────────────────────────────────

export default function CustomerProfile() {
  const [pageState, setPageState] = useState<PageState>({ status: "loading" });
  const [form, setForm] = useState<FormState>({
    description: "",
    phoneNumber: "",
    country: "",
    city: "",
    timeZone: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProfile = useCallback(async () => {
    setPageState({ status: "loading" });
    try {
      const { user } = await profileApi.getProfile();
      setPageState({ status: "ready", profile: user });
      setForm(profileToForm(user));
    } catch {
      setPageState({ status: "error", message: "Failed to load profile." });
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const data: UpdateProfileData = {
      phoneNumber: form.phoneNumber !== "" ? form.phoneNumber : undefined,
      country: form.country !== "" ? form.country : undefined,
      city: form.city !== "" ? form.city : undefined,
      timeZone: form.timeZone !== "" ? form.timeZone : undefined,
      description: form.description !== "" ? form.description : undefined,
    };
    try {
      const { user } = await profileApi.updateProfile(data);
      setPageState({ status: "ready", profile: user });
      setForm(profileToForm(user));
      window.toast({ title: "Profile saved", description: "Your changes have been saved." });
    } catch {
      window.toast({
        title: "Error",
        description: "Failed to save profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [form]);

  const handleAvatarClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleAvatarChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploadingAvatar(true);
      try {
        const { imageUrl } = await profileApi.uploadAvatar(file);
        setPageState((prev) => {
          if (prev.status !== "ready") return prev;
          return { ...prev, profile: { ...prev.profile, image: imageUrl } };
        });
        window.toast({ title: "Avatar updated successfully." });
      } catch {
        window.toast({
          title: "Upload failed",
          description: "Unable to upload avatar. Please try again.",
          variant: "destructive",
        });
      } finally {
        setUploadingAvatar(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [],
  );

  // ── Loading state ──────────────────────────────────────────────────────

  if (pageState.status === "loading") {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="space-y-4 py-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────

  if (pageState.status === "error") {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive">{pageState.message}</p>
            <Button variant="outline" className="mt-4" onClick={loadProfile}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { profile } = pageState;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">My Profile</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your personal information
        </p>
      </div>

      {/* Avatar Section */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Photo</CardTitle>
          <CardDescription>
            Upload a photo to personalize your profile
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <div className="relative shrink-0">
            <Avatar className="h-20 w-20">
              {profile.image ? (
                <AvatarImage src={profile.image} alt={profile.username} />
              ) : null}
              <AvatarFallback className="text-lg">
                {profile.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition-opacity hover:opacity-90 disabled:opacity-50"
              aria-label="Change profile photo"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
              aria-label="Upload profile photo"
            />
          </div>
          <div>
            <p className="font-semibold">{profile.username}</p>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
            <Badge variant="secondary" className="mt-1 capitalize">
              {profile.role}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your profile details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="description">Bio</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Tell others about yourself and your interests..."
              rows={4}
            />
          </div>

          <Separator />

          {/* Contact & Location */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <PhoneInput
                value={form.phoneNumber}
                onChange={(value) =>
                  setForm((f) => ({ ...f, phoneNumber: value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Time Zone</Label>
              <Input
                id="timezone"
                value={form.timeZone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, timeZone: e.target.value }))
                }
                placeholder="e.g. America/New_York"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={form.country}
                onChange={(e) =>
                  setForm((f) => ({ ...f, country: e.target.value }))
                }
                placeholder="Country"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) =>
                  setForm((f) => ({ ...f, city: e.target.value }))
                }
                placeholder="City"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account Info (read-only) */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Read-only details managed by the system</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-sm text-muted-foreground">Username</span>
            <span className="text-sm font-medium">{profile.username}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{profile.email}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">Account Status</span>
            <Badge
              variant={profile.status === "active" ? "default" : "outline"}
              className="capitalize"
            >
              {profile.status}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
