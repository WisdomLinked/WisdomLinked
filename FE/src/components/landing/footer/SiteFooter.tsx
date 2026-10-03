import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import Container, { CARD_ALIGNED_INSET_X } from '../Container';
import ComingSoonLink from './ComingSoonLink';
import FooterInfoDialog from './FooterInfoDialog';
import { FOOTER_COLUMNS, FOOTER_LEGAL_LINKS } from './footerContent';
import type { FooterInfoId, FooterLink } from './footerContent';

const COLUMN_LINK = 'text-slate-400 hover:text-white text-sm transition-colors text-left';
const LEGAL_LINK = 'text-slate-500 hover:text-white text-sm transition-colors';

function FooterLinkItem({ link, className, onOpenInfo }: { link: FooterLink; className: string; onOpenInfo: (id: FooterInfoId) => void }) {
    switch (link.kind) {
        case 'info':
            return <button type="button" onClick={() => onOpenInfo(link.contentId)} className={className}>{link.label}</button>;
        case 'comingSoon':
            return <ComingSoonLink label={link.label} />;
        case 'route':
            return <Link to={link.to} className={className}>{link.label}</Link>;
        case 'external':
            return <a href={link.href} target="_blank" rel="noopener noreferrer" className={className}>{link.label}</a>;
    }
}

export default function SiteFooter({ onContact }: { onContact: () => void }) {
    const [infoId, setInfoId] = useState<FooterInfoId | null>(null);

    return (
        <footer className="footer-bg text-white overflow-x-hidden">
            <Container className="pt-12 sm:pt-16 pb-6 sm:pb-8">
                <div className={CARD_ALIGNED_INSET_X}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8 sm:gap-y-12 mb-8 sm:mb-12">
                        <div className="md:col-span-2 lg:col-span-1">
                            <div className="flex items-center gap-3 mb-4">
                                <img src="/logos/b_w.svg" alt="WisdomLinked" className="h-10 w-auto max-w-[200px] object-contain object-left" />
                                <div><div className="font-display font-bold text-lg text-white">WisdomLinked</div><div className="text-xs text-[#D9EAFD]">Connect with experts</div></div>
                            </div>
                            <p className="text-slate-400 text-sm leading-relaxed">Connecting expertise with ambition, globally.</p>
                            <button onClick={onContact} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-white text-sm font-semibold transition">
                                <MessageCircle className="w-4 h-4" /> Contact Us
                            </button>
                        </div>
                        {FOOTER_COLUMNS.map(column => (
                            <div key={column.heading}>
                                <div className={`font-semibold text-white text-sm tracking-wide ${column.note ? 'mb-1' : 'mb-4'}`}>{column.heading}</div>
                                {column.note && <div className="text-slate-500 text-xs mb-4">{column.note}</div>}
                                <ul className="space-y-2.5">
                                    {column.links.map(link => (
                                        <li key={link.label}><FooterLinkItem link={link} className={COLUMN_LINK} onOpenInfo={setInfoId} /></li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                    <div className="pt-6 sm:pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
                        <div className="text-slate-500 text-sm">© 2026 WisdomLinked. All rights reserved.</div>
                        <div className="flex gap-6">
                            {FOOTER_LEGAL_LINKS.map(link => (
                                <FooterLinkItem key={link.label} link={link} className={LEGAL_LINK} onOpenInfo={setInfoId} />
                            ))}
                        </div>
                    </div>
                </div>
            </Container>
            <FooterInfoDialog
                contentId={infoId}
                onClose={() => setInfoId(null)}
                onAction={action => { if (action === 'contact') onContact(); }}
            />
        </footer>
    );
}
