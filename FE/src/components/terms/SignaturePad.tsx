import { useEffect, useRef, type PointerEvent } from 'react';

const MAX_DATA_URL_CHARS = 500 * 1024;

function safeContext(canvas: HTMLCanvasElement | null) {
    if (!canvas) return null;
    if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '')) return null;
    try {
        return canvas.getContext('2d');
    } catch {
        return null;
    }
}

type Props = {
    onChange: (dataUrl: string | null) => void;
    /** Saved PNG to redraw when the pad is opened again. */
    value?: string | null;
};

/** Mouse and touch drawing. Exports a PNG data URL, capped around 500KB. */
export default function SignaturePad({ onChange, value }: Props) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawing = useRef(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = safeContext(canvas);
        if (!canvas || !ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#1A3A4A';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (!value || !value.startsWith('data:image/')) return;
        const image = new Image();
        image.onload = () => {
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        };
        image.src = value;
    }, [value]);

    const point = (event: PointerEvent<HTMLCanvasElement>) => {
        const canvas = event.currentTarget;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / (rect.width || canvas.width);
        const scaleY = canvas.height / (rect.height || canvas.height);
        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY,
        };
    };

    const publish = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const url = canvas.toDataURL('image/png');
        if (!url.startsWith('data:image/png') || url.length > MAX_DATA_URL_CHARS) {
            onChange(null);
            return;
        }
        onChange(url);
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = safeContext(canvas);
        if (!canvas || !ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        onChange(null);
    };

    return (
        <div>
            <canvas
                ref={canvasRef}
                width={560}
                height={160}
                className="w-full rounded-xl border border-slate-300 bg-white touch-none"
                aria-label="Draw your signature"
                onPointerDown={(event) => {
                    const ctx = safeContext(event.currentTarget);
                    if (!ctx) return;
                    drawing.current = true;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    const { x, y } = point(event);
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                }}
                onPointerMove={(event) => {
                    if (!drawing.current) return;
                    const ctx = safeContext(event.currentTarget);
                    if (!ctx) return;
                    const { x, y } = point(event);
                    ctx.lineTo(x, y);
                    ctx.stroke();
                }}
                onPointerUp={(event) => {
                    if (!drawing.current) return;
                    drawing.current = false;
                    publish();
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                }}
                onPointerCancel={() => {
                    drawing.current = false;
                }}
            />
            <button
                type="button"
                onClick={clear}
                className="mt-2 text-sm font-medium text-[#234C6A] hover:underline"
            >
                Clear signature
            </button>
        </div>
    );
}
