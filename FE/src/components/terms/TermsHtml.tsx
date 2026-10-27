import DOMPurify from 'dompurify';

export default function TermsHtml({ html }: { html: string }) {
    const clean = DOMPurify.sanitize(html || '', {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    });
    return (
        <div
            className="terms-html space-y-3 text-sm leading-relaxed text-slate-700 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-[#234C6A] [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: clean }}
        />
    );
}
