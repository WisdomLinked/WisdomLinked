export type HelpBotRole = 'user' | 'assistant';

export type HelpBotSource = 'faq' | 'ai';

export type HelpBotMessage = {
  id: string;
  role: HelpBotRole;
  content: string;
  /** Present on assistant messages once resolved. */
  source?: HelpBotSource;
  pending?: boolean;
  error?: boolean;
  /** User turn id this assistant reply answers (for retry). */
  replyToId?: string;
};

export type SimilarQuestion = {
  id?: string;
  question: string;
};

export type FeedbackValue = 'up' | 'down';

export const HELP_BOT_STORAGE_KEY = 'wl-helpbot-v1';
export const BRAND_NAVY = '#234C6A';
