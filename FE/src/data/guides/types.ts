export type GuideIcon = 'graduation' | 'award';

export type GuideSection = {
  id: string;
  title: string;
  content: string;
  order: number;
};

export type Guide = {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: GuideIcon;
  order: number;
  published: boolean;
  sections: GuideSection[];
};
