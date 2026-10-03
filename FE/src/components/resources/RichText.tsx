import React from 'react';
import type { RichText as RichTextParts } from '../../content/resourcesTimeline';
import ExternalLink from './ExternalLink';
import { FOCUS_RING } from './styles';

export default function RichText({ parts }: { parts: RichTextParts }) {
  return (
    <>
      {parts.map((part, i) =>
        typeof part === 'string' ? (
          <React.Fragment key={i}>{part}</React.Fragment>
        ) : (
          <ExternalLink
            key={i}
            href={part.href}
            className={`rounded-sm font-semibold text-res-blue underline underline-offset-2 hover:text-wl-brand ${FOCUS_RING}`}
          >
            {part.text}
          </ExternalLink>
        ),
      )}
    </>
  );
}
