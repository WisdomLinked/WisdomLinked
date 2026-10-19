/** Id for a user ref stored as an id string or a populated user. */
export function memberId(person: unknown): string {
  if (person == null) return "";
  if (typeof person === "string" || typeof person === "number") return String(person);
  if (typeof person === "object") {
    const rec = person as { _id?: unknown; id?: unknown };
    if (rec._id != null && rec._id !== "") return String(rec._id);
    if (rec.id != null && rec.id !== "") return String(rec.id);
  }
  return "";
}

/**
 * People on a session besides the host. The host is often not the first
 * participant, so dropping index 0 shows the host again as a participant.
 */
export function participantsExceptAdmin<T>(participants: T[] | null | undefined, admin: unknown): T[] {
  const adminId = memberId(admin);
  return (participants || []).filter((person) => {
    const id = memberId(person);
    if (!id) return true;
    return !adminId || id !== adminId;
  });
}
