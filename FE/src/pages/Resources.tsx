import React from 'react';
import PublicPageShell from '../components/landing/PublicPageShell';
import ResourcesSection from '../components/resources/ResourcesSection';

export default function Resources() {
  return (
    <PublicPageShell contentClassName="bg-white">
      <ResourcesSection />
    </PublicPageShell>
  );
}
