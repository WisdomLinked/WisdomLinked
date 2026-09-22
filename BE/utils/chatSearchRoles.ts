const ALL_SEARCHABLE_ROLES = ['expert', 'customer'];

export function searchableRolesFor(viewerRole: unknown): string[] {
    const role = String(viewerRole ?? '').trim().toLowerCase();
    if (role === 'customer') return ['customer'];
    return [...ALL_SEARCHABLE_ROLES];
}
