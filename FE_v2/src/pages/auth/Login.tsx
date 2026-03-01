import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/hooks/useAuth";
import { authApi } from "@/api/authApi";
import { settingsApi } from "@/api/settingsApi";
import type { PublicSettings } from "@/api/settingsApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, LogIn } from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────

function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const msg = error.response?.data?.message;
    if (typeof msg === "string") return msg;
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

// ── Discord SVG icon ───────────────────────────────────────────────────────

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

// ── Settings loading state ─────────────────────────────────────────────────

type SettingsLoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "loaded"; readonly settings: PublicSettings }
  | { readonly kind: "error"; readonly message: string };

// ── Main LoginPage component ───────────────────────────────────────────────

export default function LoginPage() {
  const { login, isLoading: authLoading } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [touched, setTouched] = useState({ username: false, password: false });

  const [settingsState, setSettingsState] = useState<SettingsLoadState>({
    kind: "loading",
  });

  // Load public settings to show/hide login methods
  useEffect(() => {
    let cancelled = false;

    settingsApi
      .getPublicSettings()
      .then((settings) => {
        if (!cancelled) {
          setSettingsState({ kind: "loaded", settings });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          // Fall back to showing all methods on settings fetch failure
          setSettingsState({
            kind: "loaded",
            settings: { registrationEnabled: true, loginMethods: { local: true, discord: true } },
          });
          console.error("Failed to load public settings:", err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDiscordLogin(): Promise<void> {
    try {
      const { authUrl } = await authApi.getDiscordAuthUrl();
      window.location.href = authUrl;
    } catch (err: unknown) {
      setErrorMessage(getApiErrorMessage(err));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setTouched({ username: true, password: true });

    if (!username.trim() || !password) return;

    setErrorMessage("");
    try {
      await login({ username: username.trim(), password });
    } catch (err: unknown) {
      setErrorMessage(getApiErrorMessage(err));
    }
  }

  const showLocal =
    settingsState.kind !== "loaded" || settingsState.settings.loginMethods.local;
  const showDiscord =
    settingsState.kind !== "loaded" || settingsState.settings.loginMethods.discord;

  const isLoadingSettings = settingsState.kind === "loading";

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
          <p className="text-muted-foreground">
            Sign in to your WisdomLinked account
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Sign In</CardTitle>
            <CardDescription>
              Use your username and password to continue
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Discord OAuth button */}
            {isLoadingSettings ? (
              <Skeleton className="h-10 w-full" />
            ) : showDiscord ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleDiscordLogin}
                  disabled={authLoading}
                >
                  <DiscordIcon className="h-4 w-4 mr-2 text-foreground/70" />
                  Continue with Discord
                </Button>

                {showLocal && (
                  <div className="flex items-center gap-3 my-2">
                    <Separator className="flex-1" />
                    <span className="text-xs text-muted-foreground">or</span>
                    <Separator className="flex-1" />
                  </div>
                )}
              </>
            ) : null}

            {/* Local login form */}
            {isLoadingSettings ? (
              <div className="space-y-4">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : showLocal ? (
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {/* Username */}
                <div className="space-y-1.5">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Your username"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setErrorMessage("");
                    }}
                    onBlur={() =>
                      setTouched((prev) => ({ ...prev, username: true }))
                    }
                    className={cn(
                      touched.username && !username.trim()
                        ? "border-destructive"
                        : ""
                    )}
                    autoComplete="username"
                  />
                  {touched.username && !username.trim() && (
                    <p className="text-xs text-destructive">
                      Username is required.
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Your password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrorMessage("");
                      }}
                      onBlur={() =>
                        setTouched((prev) => ({ ...prev, password: true }))
                      }
                      className={cn(
                        "pr-10",
                        touched.password && !password ? "border-destructive" : ""
                      )}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowPassword((prev) => !prev)}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {touched.password && !password && (
                    <p className="text-xs text-destructive">
                      Password is required.
                    </p>
                  )}
                </div>

                {/* API error */}
                {errorMessage && (
                  <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                    {errorMessage}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={authLoading}
                >
                  {authLoading ? (
                    "Signing in..."
                  ) : (
                    <>
                      <LogIn className="h-4 w-4 mr-2" />
                      Sign In
                    </>
                  )}
                </Button>
              </form>
            ) : null}

            {/* Register links */}
            <div className="pt-2 border-t border-border">
              <p className="text-sm text-center text-muted-foreground mb-2">
                Don't have an account?
              </p>
              <div className="flex gap-3">
                <Link to="/register/customer" className="flex-1">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    Customer Register
                  </Button>
                </Link>
                <Link to="/register/expert" className="flex-1">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    Expert Register
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
