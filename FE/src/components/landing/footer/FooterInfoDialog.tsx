import { useEffect, useId, useRef } from 'react';
import type { MouseEvent } from 'react';
import { X } from 'lucide-react';
import { FOOTER_INFO } from './footerContent';
import type { FooterDialogAction, FooterInfoId } from './footerContent';

const PRIMARY_BG = { background: 'linear-gradient(135deg, #234C6A 0%, #456882 100%)' };

interface Props {
    contentId: FooterInfoId | null;
    onClose: () => void;
    onAction?: (action: FooterDialogAction) => void;
}

export default function FooterInfoDialog({ contentId, onClose, onAction }: Props) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const triggerRef = useRef<HTMLElement | null>(null);
    const titleId = useId();
    const content = contentId ? FOOTER_INFO[contentId] : null;

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (contentId && !dialog.open) {
            triggerRef.current = document.activeElement as HTMLElement | null;
            dialog.showModal();
        } else if (!contentId && dialog.open) {
            dialog.close();
        }
    }, [contentId]);

    const handleClose = () => {
        onClose();
        triggerRef.current?.focus();
        triggerRef.current = null;
    };

    const handleBackdropClick = (e: MouseEvent<HTMLDialogElement>) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (!inside) e.currentTarget.close();
    };

    const runAction = (action: FooterDialogAction) => {
        dialogRef.current?.close();
        onAction?.(action);
    };

    return (
        <dialog
            ref={dialogRef}
            aria-labelledby={titleId}
            onClose={handleClose}
            onClick={handleBackdropClick}
            onKeyDown={e => {
                if (e.key !== 'Escape') return;
                e.preventDefault();
                e.currentTarget.close();
            }}
            className="m-auto w-[calc(100%-2rem)] max-w-md max-h-[calc(100%-2rem)] overflow-y-auto rounded-3xl border-0 p-0 shadow-2xl backdrop:bg-[rgba(15,15,35,0.65)] backdrop:backdrop-blur-[8px]"
            style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', fontFamily: "'DM Sans', sans-serif" }}
        >
            {content && (
                <>
                    <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #234C6A, #456882, #234C6A)' }} />
                    <button
                        type="button"
                        aria-label="Close"
                        onClick={() => dialogRef.current?.close()}
                        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-500 transition-all duration-200 z-10"
                    >
                        <X size={16} />
                    </button>
                    <div className="p-7 pb-8">
                        <h2 id={titleId} className="text-2xl font-bold text-slate-800 leading-tight pr-8">{content.title}</h2>
                        <div className={`mt-3 space-y-3 text-sm text-slate-700 leading-relaxed ${content.address ? '' : 'text-left min-[400px]:text-justify min-[400px]:[text-justify:inter-word]'}`}>
                            {content.address ? (
                                <address className="not-italic select-text">
                                    {content.paragraphs.map(line => <div key={line}>{line}</div>)}
                                </address>
                            ) : (
                                content.paragraphs.map(p => <p key={p}>{p}</p>)
                            )}
                        </div>
                        <div className="mt-7 flex items-center justify-end gap-5">
                            {content.secondaryAction && (
                                <button
                                    type="button"
                                    onClick={() => runAction(content.secondaryAction!.action)}
                                    className="text-sm font-semibold text-[#234C6A] hover:underline"
                                >
                                    {content.secondaryAction.label}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => dialogRef.current?.close()}
                                className="px-8 py-3 rounded-2xl text-sm font-semibold text-white shadow"
                                style={PRIMARY_BG}
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </>
            )}
        </dialog>
    );
}
