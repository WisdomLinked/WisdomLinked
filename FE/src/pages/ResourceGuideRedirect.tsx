import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { mockGuides } from '../data/guides/mockGuides';
import { GUIDES_PATH } from '../components/resources/useResourceLinks';

const KNOWN_SLUGS = new Set(mockGuides.map(guide => guide.slug));

/** Old per-guide URLs now point at their part of the combined guides page. */
export default function ResourceGuideRedirect() {
  const { slug = '' } = useParams<{ slug: string }>();
  const to = KNOWN_SLUGS.has(slug) ? `${GUIDES_PATH}#${slug}` : GUIDES_PATH;
  return <Navigate to={to} replace />;
}
