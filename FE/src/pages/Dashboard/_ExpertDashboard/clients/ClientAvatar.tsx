import React from 'react';
import { getAvatarTitle } from '../../../../actions/common';
import { getAvatarPaletteForId } from '../../../../utils/avatarColor';

const SIZE = {
  lg: 'h-20 w-20 text-2xl',
  sm: 'h-9 w-9 text-xs',
} as const;

export default function ClientAvatar({
  id,
  name,
  src,
  size = 'lg',
}: {
  id: string;
  name: string;
  src: string | null;
  size?: keyof typeof SIZE;
}) {
  const palette = getAvatarPaletteForId(id);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ${SIZE[size]}`}
      style={src ? undefined : { backgroundColor: palette.bg, color: palette.text }}
      aria-hidden
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover object-center" />
      ) : (
        getAvatarTitle(name)
      )}
    </span>
  );
}
