import { useState, useEffect } from "react";
import { settingsApi, SystemSettings } from "@/api/adminApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Settings as SettingsIcon, Save } from "lucide-react";

const defaultSettings: SystemSettings = {
  registrationEnabled: false,
  loginMethods: {
    local: false,
    discord: false,
  },
  discordOAuth: {
    clientId: "",
    clientSecret: "",
    redirectUri: "",
  },
};

function normalizeSettings(settings: Partial<SystemSettings> | undefined): SystemSettings {
  return {
    registrationEnabled: settings?.registrationEnabled ?? false,
    loginMethods: {
      local: settings?.loginMethods?.local ?? false,
      discord: settings?.loginMethods?.discord ?? false,
    },
    discordOAuth: {
      clientId: settings?.discordOAuth?.clientId ?? "",
      clientSecret: settings?.discordOAuth?.clientSecret ?? "",
      redirectUri: settings?.discordOAuth?.redirectUri ?? "",
    },
  };
}

export function Settings() {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await settingsApi.getSettings();
      setSettings(normalizeSettings(response.settings));
      setHasLoaded(true);
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!hasLoaded) return;

    try {
      setSaving(true);
      await settingsApi.updateSettings(settings);
      if (window.toast) {
        window.toast({
          title: "Success",
          description: "Settings saved successfully",
        });
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Settings</h1>
          <p className="text-muted-foreground mt-1">Configure authentication and registration</p>
        </div>
        <Button onClick={handleSave} disabled={saving || loading || !hasLoaded}>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoadingSpinner size="sm" />
          <span>Loading settings...</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Registration
          </CardTitle>
          <CardDescription>Control user registration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.registrationEnabled}
              onChange={(e) =>
                setSettings({ ...settings, registrationEnabled: e.target.checked })
              }
              disabled={loading || saving}
              className="w-4 h-4"
            />
            <div>
              <div className="font-medium">Enable Registration</div>
              <div className="text-sm text-muted-foreground">
                Allow new users to create accounts
              </div>
            </div>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Login Methods</CardTitle>
          <CardDescription>Enable or disable authentication methods</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.loginMethods.local}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  loginMethods: { ...settings.loginMethods, local: e.target.checked },
                })
              }
              disabled={loading || saving}
              className="w-4 h-4"
            />
            <div>
              <div className="font-medium">Username/Password Login</div>
              <div className="text-sm text-muted-foreground">
                Allow users to log in with username and password
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.loginMethods.discord}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  loginMethods: { ...settings.loginMethods, discord: e.target.checked },
                })
              }
              disabled={loading || saving}
              className="w-4 h-4"
            />
            <div>
              <div className="font-medium">Discord OAuth</div>
              <div className="text-sm text-muted-foreground">
                Allow users to log in with Discord
              </div>
            </div>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Discord OAuth Configuration</CardTitle>
          <CardDescription>
            Configure Discord OAuth application settings in the{" "}
            <a
              href="https://discord.com/developers/applications"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Discord Developer Portal
            </a>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Client ID</label>
            <Input
              value={settings.discordOAuth.clientId}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  discordOAuth: { ...settings.discordOAuth, clientId: e.target.value },
                })
              }
              disabled={loading || saving}
              placeholder="Your Discord Client ID"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Client Secret</label>
            <Input
              type="password"
              value={settings.discordOAuth.clientSecret ?? ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  discordOAuth: { ...settings.discordOAuth, clientSecret: e.target.value },
                })
              }
              disabled={loading || saving}
              placeholder="Your Discord Client Secret"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Redirect URI</label>
            <Input
              value={settings.discordOAuth.redirectUri}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  discordOAuth: { ...settings.discordOAuth, redirectUri: e.target.value },
                })
              }
              disabled={loading || saving}
              placeholder="http://localhost:5000/api/v1/oauth/discord/callback"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Make sure this matches your Discord application's redirect URI
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

