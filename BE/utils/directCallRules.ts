export const canStartDirectMessageCall = (role: unknown): boolean =>
    String(role || '').toLowerCase() !== 'customer';
