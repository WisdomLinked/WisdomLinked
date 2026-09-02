const AVATAR_PALETTES: { bg: string; text: string }[] = [
  { bg: '#EEEDFE', text: '#534AB7' },
  { bg: '#FAECE7', text: '#993C1D' },
  { bg: '#FAEEDA', text: '#854F0B' },
  { bg: '#E6F1FB', text: '#185FA5' },
  { bg: '#FBEAF0', text: '#993556' },
  { bg: '#FEF3C7', text: '#92400E' },
];

/** Palette index is derived from the displayed initials (not full name) so color matches the avatar glyph. */
export function getAvatarPalette(initials: string): { bg: string; text: string } {
  const key = initials.trim() || '?';
  const index =
    key.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % AVATAR_PALETTES.length;
  const palette = AVATAR_PALETTES[index];
  return { bg: palette.bg, text: palette.text };
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(part => part.length > 0);
  if (parts.length === 0) {
    return '?';
  }
  return parts
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Tailwind `bg-*` segment for the DM sidebar status dot. */
export function getPrivateDmStatusDotClass(
  presence: 'online' | 'away' | 'offline',
): string {
  switch (presence) {
    case 'online':
      return 'bg-[#1D9E75]';
    case 'away':
      return 'bg-[#EF9F27]';
    case 'offline':
      return 'bg-[#B4B2A9]';
  }
}
