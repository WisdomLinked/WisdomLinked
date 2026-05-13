export const buildFallbackChatProfile = (chosenChatDetails: any, myRole: string) => {
  const me = String(myRole || "").toLowerCase();
  const inferredOtherRole = me === "expert" ? "customer" : me === "customer" ? "expert" : "member";
  return {
    _id: String(chosenChatDetails?.userId || ""),
    username: String(chosenChatDetails?.username || "Member"),
    email: "",
    image: chosenChatDetails?.image || null,
    role: inferredOtherRole,
    country: null,
    keywords: [],
    services: [],
  };
};

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

const humanizeBackendCode = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed || OBJECT_ID_RE.test(trimmed)) return "";
  return trimmed
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export const profileOptionLabel = (item: unknown): string => {
  if (typeof item === "string") return humanizeBackendCode(item);
  if (!item || typeof item !== "object") return "";

  const option = item as Record<string, unknown>;
  const candidates = [option.label, option.name, option.title, option.value];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const value = candidate.trim();
    if (!value || OBJECT_ID_RE.test(value)) continue;
    if (candidate === option.value && !option.label) return humanizeBackendCode(value);
    return value;
  }
  return "";
};

export const collectProfileOptionLabels = (items: unknown): string[] => {
  if (!Array.isArray(items)) return [];
  const labels: string[] = [];
  items.forEach((item) => {
    const label = profileOptionLabel(item);
    if (label && !labels.includes(label)) labels.push(label);
  });
  return labels;
};

export const mergeChatProfile = (fallbackProfile: any, apiProfile: any) => {
  if (!apiProfile || typeof apiProfile !== "object") return fallbackProfile;
  return {
    ...fallbackProfile,
    ...apiProfile,
    username: String(apiProfile?.username || fallbackProfile?.username || "Member"),
    role: String(apiProfile?.role || fallbackProfile?.role || "member"),
    keywords: Array.isArray(apiProfile?.keywords) ? apiProfile.keywords : fallbackProfile?.keywords ?? [],
    services: Array.isArray(apiProfile?.services) ? apiProfile.services : fallbackProfile?.services ?? [],
  };
};

