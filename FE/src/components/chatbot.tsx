import React, { useState, useRef, useEffect } from "react";
import { getChatBotAnswer } from "../api/api";
import { MessageSquare, X } from "lucide-react";

interface ChatItem {
    question: string;
    answer: string;
    similarQuestions?: { id: string; question: string }[];
}

const Chatbot = () => {
    const [isMinimized, setIsMinimized] = useState<boolean>(true);
    const [input, setInput] = useState<string>("");
    const [chat, setChat] = useState<ChatItem[]>([]);
    const [similarQuestions, setSimilarQuestions] = useState<{ id: string; question: string }[]>([]);
    const chatHistoryRef = useRef<HTMLDivElement | null>(null);

    const primaryBlue = "#234C6A";

    // Initial static FAQs for first load
    const staticFaqs = [
        "How to accept a meeting?",
        "How to upload/change my avatar image?",
        "What does the calendar do?"
    ];

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInput(e.target.value);
    };

    const handleChatSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        const response = await getChatBotAnswer({ question: input });
        setChat([
            ...chat,
            { question: input, answer: response.answer, similarQuestions: response.similarQuestions }
        ]);
        setSimilarQuestions(response.similarQuestions || []);
        setInput("");
    };

    const handleQuickAction = async (faqInput: string) => {
        const response = await getChatBotAnswer({ question: faqInput });
        setChat([
            ...chat,
            { question: faqInput, answer: response.answer, similarQuestions: response.similarQuestions }
        ]);
        setSimilarQuestions(response.similarQuestions || []);
        setInput("");
    };

    useEffect(() => {
        if (chatHistoryRef.current) {
            chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
        }
    }, [chat]);

    return (
        <div className="fixed bottom-4 right-4 z-50">
            {isMinimized ? (
                <button
                    type="button"
                    onClick={() => setIsMinimized(false)}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#234C6A] bg-[#234C6A] px-3 py-2 shadow-[0_12px_30px_rgba(26,58,74,0.16)] hover:shadow-[0_18px_45px_rgba(26,58,74,0.22)] transition-shadow"
                    aria-label="Open HelpBot"
                >
                    <MessageSquare className="h-4 w-4 text-white" aria-hidden />
                    <span className="text-[13px] font-semibold text-white">HelpBot</span>
                </button>
            ) : (
                <div className="w-[360px] max-w-[calc(100vw-32px)] h-[520px] rounded-lg border border-[#E5E2DB] bg-white shadow-[0_18px_55px_rgba(26,58,74,0.20)] overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-[#234C6A]">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10">
                                <MessageSquare className="h-4 w-4 text-white" aria-hidden />
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-white truncate">HelpBot</div>
                                <div className="text-[10px] font-medium text-white/80 truncate">
                                    Ask FAQs anytime
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsMinimized(true)}
                            className="p-1 rounded-md text-white/90 hover:bg-white/10"
                            aria-label="Minimize HelpBot"
                        >
                            <X className="h-4 w-4" aria-hidden />
                        </button>
                    </div>

                    <div className="flex flex-col h-[calc(520px-48px)]">
                        {/* Chat history */}
                        <div
                            ref={chatHistoryRef}
                            className="flex-1 overflow-y-auto p-4 bg-[#F5F3EF]"
                        >
                            {chat.length === 0 ? (
                                <p className="text-sm text-[#7A7A72] text-center mt-6">
                                    Select a frequently asked question below or type your question.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {chat.map((c, index) => (
                                        <div key={index} className="space-y-2">
                                            <div className="flex justify-end">
                                                <div className="max-w-[85%] rounded-md bg-[#234C6A] px-3 py-2 text-sm text-white whitespace-pre-wrap">
                                                    {c.question}
                                                </div>
                                            </div>
                                            <div className="flex justify-start">
                                                <div className="max-w-[85%] rounded-md border border-[#234C6A] bg-[#234C6A] px-3 py-2 text-sm text-white whitespace-pre-wrap">
                                                    {c.answer}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Quick actions */}
                        <div className="border-t border-[#E5E2DB] bg-white px-3 py-3">
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-[11px] font-semibold uppercase tracking-widest text-[#7A7A72]">
                                    {chat.length === 0
                                        ? "Frequently asked"
                                        : "Similar questions"}
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 max-h-24 overflow-y-auto pr-1">
                                {chat.length === 0 ? (
                                    staticFaqs.map((q: string) => (
                                        <button
                                            key={q}
                                            type="button"
                                            onClick={() => handleQuickAction(q)}
                                            className="w-full text-left rounded-md border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-2 text-sm text-[#234C6A] hover:bg-white transition-colors"
                                        >
                                            {q}
                                        </button>
                                    ))
                                ) : similarQuestions.length > 0 ? (
                                    similarQuestions.map((q: { id: string; question: string }) => (
                                        <button
                                            key={q.id}
                                            type="button"
                                            onClick={() => handleQuickAction(q.question)}
                                            className="w-full text-left rounded-md border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-2 text-sm text-[#234C6A] hover:bg-white transition-colors"
                                        >
                                            {q.question}
                                        </button>
                                    ))
                                ) : (
                                    <div className="text-sm text-[#7A7A72] px-1">
                                        No similar questions found.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Input bar */}
                        <form
                            onSubmit={handleChatSubmit}
                            className="flex items-center gap-2 p-3 border-t border-[#E5E2DB] bg-[#F5F3EF]"
                        >
                            <input
                                type="text"
                                value={input}
                                onChange={handleInput}
                                className="flex-1 rounded-md border border-[#E5E2DB] bg-white px-3 py-2 text-sm text-[#234C6A] outline-none focus:ring-2 focus:ring-[#234C6A]/20"
                                placeholder="Ask me a question..."
                            />
                            <button
                                type="submit"
                                className="rounded-[4px] bg-[#234C6A] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1f3f5a] disabled:opacity-60"
                                disabled={!input.trim()}
                            >
                                Send
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Chatbot;