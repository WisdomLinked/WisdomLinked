export default function TypingIndicator() {
  return (
    <div className="flex justify-start gap-2" role="status" aria-label="HelpBot is answering">
      <div
        className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#234C6A]/10"
        aria-hidden
      >
        <span className="h-2 w-2 rounded-full bg-[#234C6A]" />
      </div>
      <div className="rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3 text-slate-800">
        <span className="inline-flex items-center gap-1" aria-hidden>
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
        </span>
      </div>
    </div>
  );
}
