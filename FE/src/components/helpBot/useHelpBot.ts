import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { askSite } from '../../api/api';
import { isStaticFaq, STATIC_FAQS } from './faqData';
import {
  HELP_BOT_STORAGE_KEY,
  type FeedbackValue,
  type HelpBotMessage,
  type SimilarQuestion,
} from './types';

type StoredState = {
  messages: HelpBotMessage[];
  similarQuestions: SimilarQuestion[];
};

function newId() {
  return `hb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readStored(): StoredState {
  try {
    const raw = sessionStorage.getItem(HELP_BOT_STORAGE_KEY);
    if (!raw) return { messages: [], similarQuestions: [] };
    const parsed = JSON.parse(raw) as StoredState;
    if (!Array.isArray(parsed?.messages)) return { messages: [], similarQuestions: [] };
    const messages = parsed.messages.filter(
      (m) =>
        m &&
        typeof m.id === 'string' &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string',
    );
    const similarQuestions = Array.isArray(parsed.similarQuestions)
      ? parsed.similarQuestions.filter((q) => q && typeof q.question === 'string')
      : [];
    return {
      messages: messages.filter((m) => !m.pending),
      similarQuestions,
    };
  } catch {
    return { messages: [], similarQuestions: [] };
  }
}

function writeStored(state: StoredState) {
  try {
    sessionStorage.setItem(
      HELP_BOT_STORAGE_KEY,
      JSON.stringify({
        messages: state.messages.filter((m) => !m.pending),
        similarQuestions: state.similarQuestions,
      }),
    );
  } catch {
    // ignore quota / private mode
  }
}

export function onFeedback(_messageId: string, _value: FeedbackValue) {
  // Stub until a feedback API exists.
}

export function useHelpBot() {
  const initial = useMemo(() => readStored(), []);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<HelpBotMessage[]>(initial.messages);
  const [similarQuestions, setSimilarQuestions] = useState<SimilarQuestion[]>(
    initial.similarQuestions,
  );
  const [pending, setPending] = useState(false);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [showJumpPill, setShowJumpPill] = useState(false);

  const pendingRef = useRef(false);
  const messagesRef = useRef(messages);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);

  messagesRef.current = messages;

  useEffect(() => {
    writeStored({ messages, similarQuestions });
  }, [messages, similarQuestions]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = listRef.current;
    if (!el) return;
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (!stickToBottom) {
      if (messages.some((m) => m.role === 'assistant' && !m.pending)) {
        setShowJumpPill(true);
      }
      return;
    }
    setShowJumpPill(false);
    scrollToBottom(pending ? 'auto' : 'smooth');
  }, [messages, pending, stickToBottom, scrollToBottom]);

  const handleListScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    setStickToBottom(nearBottom);
    if (nearBottom) setShowJumpPill(false);
  }, []);

  const jumpToLatest = useCallback(() => {
    setStickToBottom(true);
    setShowJumpPill(false);
    scrollToBottom('smooth');
  }, [scrollToBottom]);

  const openWidget = useCallback(() => {
    setOpen(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  const closeWidget = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => {
      launcherRef.current?.focus();
    });
  }, []);

  const resetChat = useCallback(() => {
    pendingRef.current = false;
    setPending(false);
    setMessages([]);
    setSimilarQuestions([]);
    setStickToBottom(true);
    setShowJumpPill(false);
    try {
      sessionStorage.removeItem(HELP_BOT_STORAGE_KEY);
    } catch {
      // ignore
    }
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const sendQuestion = useCallback(async (question: string) => {
    const current = question.trim();
    if (!current || pendingRef.current) return;

    const prior = messagesRef.current
      .filter((m) => !m.pending && !m.error && m.content.trim())
      .flatMap((m) => {
        if (m.role === 'user') return [{ role: 'user' as const, content: m.content }];
        return [{ role: 'assistant' as const, content: m.content }];
      })
      .slice(-8);

    const userId = newId();
    const assistantId = newId();
    const fromFaq = isStaticFaq(current);

    pendingRef.current = true;
    setPending(true);
    setStickToBottom(true);
    setMessages((prev) => [
      ...prev,
      { id: userId, role: 'user', content: current },
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        pending: true,
        replyToId: userId,
        source: fromFaq ? 'faq' : 'ai',
      },
    ]);

    try {
      const response = prior.length ? await askSite(current, prior) : await askSite(current);
      const answer = typeof response?.answer === 'string' ? response.answer : '';
      const similar = Array.isArray(response?.similarQuestions)
        ? (response.similarQuestions as SimilarQuestion[])
            .map((q) => ({
              id: typeof q?.id === 'string' ? q.id : undefined,
              question:
                typeof q?.question === 'string'
                  ? q.question
                  : String((q as { question?: unknown })?.question ?? ''),
            }))
            .filter((q) => q.question.trim())
        : [];
      setSimilarQuestions(similar.slice(0, 4));
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: answer || 'Answers are unavailable right now.',
                pending: false,
                error: false,
                source: fromFaq ? 'faq' : 'ai',
              }
            : m,
        ),
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: 'Something went wrong.',
                pending: false,
                error: true,
                source: fromFaq ? 'faq' : 'ai',
              }
            : m,
        ),
      );
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }, []);

  const retryLastError = useCallback(() => {
    const msgs = messagesRef.current;
    const err = [...msgs].reverse().find((m) => m.role === 'assistant' && m.error);
    if (!err) return;
    const userMsg = err.replyToId
      ? msgs.find((m) => m.id === err.replyToId)
      : [...msgs].reverse().find((m) => m.role === 'user');
    if (!userMsg?.content) return;
    setMessages((prev) => prev.filter((m) => m.id !== err.id && m.id !== userMsg.id));
    void sendQuestion(userMsg.content);
  }, [sendQuestion]);

  const suggestionChips = useMemo(() => {
    if (pending || messages.length === 0) return [];
    const fromApi = similarQuestions.map((q) => q.question).filter(Boolean);
    if (fromApi.length) return fromApi.slice(0, 3);
    const asked = new Set(
      messages.filter((m) => m.role === 'user').map((m) => m.content.trim().toLowerCase()),
    );
    return STATIC_FAQS.filter((q) => !asked.has(q.toLowerCase())).slice(0, 3);
  }, [similarQuestions, messages, pending]);

  return {
    open,
    openWidget,
    closeWidget,
    resetChat,
    messages,
    pending,
    sendQuestion,
    retryLastError,
    suggestionChips,
    listRef,
    inputRef,
    launcherRef,
    handleListScroll,
    showJumpPill,
    jumpToLatest,
    onFeedback,
  };
}
