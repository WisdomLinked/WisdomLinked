/** Starter FAQ questions shown in the welcome panel (same as legacy HelpBot). */
export const STATIC_FAQS = [
  'How to accept a meeting?',
  'How to upload/change my avatar image?',
  'What does the calendar do?',
] as const;

export function isStaticFaq(question: string): boolean {
  return (STATIC_FAQS as readonly string[]).includes(question.trim());
}
