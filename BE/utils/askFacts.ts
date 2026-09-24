const SERVICE_LABELS = ['Study Abroad', 'Work Abroad', 'Research Guidance'];

const EXPERT_STOPWORDS = new Set([
    'who', 'is', 'the', 'a', 'an', 'in', 'of', 'for', 'what', 'which', 'show', 'me', 'my',
    'has', 'have', 'with', 'and', 'or', 'hourly', 'rate', 'rates', 'price', 'public', 'active',
    'does', 'do', 'can', 'you', 'tell', 'about', 'their', 'there', 'any', 'all', 'please',
    'find', 'list', 'give', 'get', 'to', 'from', 'by', 'at', 'on', 'be', 'are', 'was', 'were',
    'how', 'much', 'many', 'someone', 'somebody', 'professor', 'professors', 'cheapest',
    'highest', 'under', 'over', 'most', 'expensive', 'free', 'named', 'called', 'name',
    'whose', 'whom', 'that', 'this', 'these', 'those', 'your', 'our', 'we', 'want', 'looking',
    'search', 'available', 'book', 'booking', 'expert', 'experts', 'faculty', 'teach',
    'teaches', 'teaching', 'work', 'works',
]);

const SEMINAR_STOPWORDS = new Set([
    'a', 'an', 'the', 'in', 'on', 'of', 'for', 'and', 'or', 'to', 'is', 'are', 'what', 'which',
    'who', 'show', 'me', 'my', 'find', 'list', 'seminar', 'seminars', 'upcoming', 'with',
    'about', 'please', 'any', 'all', 'from', 'by', 'at', 'be', 'do', 'does', 'how', 'much',
    'many', 'session', 'sessions', 'class', 'classes', 'there', 'this', 'that', 'your', 'our',
    'can', 'you', 'we', 'i',
]);

const OWN_RECORD_FIELDS = [
    'name',
    'description',
    'purpose',
    'start',
    'end',
    'duration',
    'timezone',
    'price',
    'currency',
    'status',
    'type',
    'maxAttendees',
    'seatsFilled',
    'recurrence',
    'services',
    'majors',
    'hostName',
    'participantNames',
    'decisionNote',
];

const EMPTY_PUBLIC_FACT = 'No active professor in Civil Engineering has a public hourly rate.';

const finiteRate = (value: unknown): number | null => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};

const textList = (value: unknown): string[] => {
    const labels: string[] = [];
    const push = (item: unknown) => {
        if (typeof item === 'string') {
            const text = item.trim();
            if (text) labels.push(text);
            return;
        }
        if (item && typeof item === 'object') {
            const record = item as { value?: unknown; name?: unknown; label?: unknown };
            push(record.value ?? record.name ?? record.label);
        }
    };
    if (Array.isArray(value)) value.forEach(push);
    else push(value);
    return labels;
};

const majorLabels = (card: any): string[] =>
    textList(card?.keywords).concat(textList(card?.majors), textList(card?.major));

const serviceLabels = (card: any): string[] => textList(card?.services);

const hasCivilEngineering = (card: any): boolean =>
    majorLabels(card).some((label) => label.toLowerCase() === 'civil engineering');

const wantsCivil = (question: string): boolean => /土木工程|土木|\bcivil\b/i.test(question);

const wantsProfessor = (question: string): boolean => /教授|\bprofessors?\b/i.test(question);

const isProfessorCard = (card: any): boolean =>
    /professor/i.test(`${card?.title ?? ''}\n${card?.bio ?? ''}`);

const requestedServices = (question: string): string[] => {
    const folded = question.toLowerCase();
    return SERVICE_LABELS.filter((label) => {
        const words = label.toLowerCase();
        const slug = words.replace(/\s+/g, '_');
        return folded.includes(words) || folded.includes(slug);
    });
};

const hasService = (card: any, label: string): boolean => {
    const want = label.toLowerCase();
    return serviceLabels(card).some((service) => service.toLowerCase() === want);
};

const numberAfter = (question: string, keyword: 'under' | 'over'): number | null => {
    const match = question.match(new RegExp(`\\b${keyword}\\b[^\\d]{0,32}(\\d+(?:\\.\\d+)?)`, 'i'));
    if (!match) return null;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
};

const leftoverTokens = (question: string): string[] => {
    let remaining = question;
    remaining = remaining.replace(/土木工程/g, ' ');
    remaining = remaining.replace(/土木/g, ' ');
    remaining = remaining.replace(/教授/g, ' ');
    remaining = remaining.replace(/最便宜/g, ' ');
    remaining = remaining.replace(/最贵/g, ' ');
    SERVICE_LABELS.forEach((label) => {
        remaining = remaining.replace(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), ' ');
    });
    remaining = remaining.replace(/\bcivil\b/ig, ' ');
    remaining = remaining.replace(/\bprofessors?\b/ig, ' ');
    remaining = remaining.replace(/\bcheapest\b/ig, ' ');
    remaining = remaining.replace(/\bhighest\b/ig, ' ');
    remaining = remaining.replace(/\b(?:under|over)\b[^\d]{0,32}\d+(?:\.\d+)?/ig, ' ');
    remaining = remaining.replace(/\bunder\b/ig, ' ');
    remaining = remaining.replace(/\bover\b/ig, ' ');
    return remaining
        .split(/[^A-Za-z0-9]+/)
        .filter((token) => token.length >= 2 && !EXPERT_STOPWORDS.has(token.toLowerCase()));
};

const expertHaystack = (card: any): string =>
    [
        card?.name,
        card?.title,
        card?.bio,
        ...majorLabels(card),
        ...serviceLabels(card),
    ]
        .map((part) => String(part ?? ''))
        .join(' ')
        .toLowerCase();

const keepExtreme = (cards: any[], which: 'min' | 'max'): any[] => {
    let best: number | null = null;
    cards.forEach((card) => {
        const rate = finiteRate(card?.hourlyRate);
        if (rate === null) return;
        if (best === null || (which === 'min' ? rate < best : rate > best)) best = rate;
    });
    if (best === null) return [];
    return cards.filter((card) => finiteRate(card?.hourlyRate) === best);
};

const formatRate = (rate: number): string => (Number.isInteger(rate) ? String(rate) : String(rate));

export const filterPublicExperts = (cards: any[], question: string): any[] => {
    const asked = String(question ?? '');
    const civil = wantsCivil(asked);
    const professor = wantsProfessor(asked);
    const services = requestedServices(asked);
    const tokens = leftoverTokens(asked);
    const under = /\bunder\b/i.test(asked) ? numberAfter(asked, 'under') : null;
    const over = /\bover\b/i.test(asked) ? numberAfter(asked, 'over') : null;
    const cheapest = /最便宜|\bcheapest\b/i.test(asked);
    const highest = /最贵|\bhighest\b/i.test(asked);

    const matched = (Array.isArray(cards) ? cards : []).filter((card) => {
        if (!card || typeof card !== 'object') return false;
        const name = String(card.name ?? card.username ?? '');
        if (name.includes('@')) return false;
        if (civil && !hasCivilEngineering(card)) return false;
        if (professor && !isProfessorCard(card)) return false;
        if (services.some((label) => !hasService(card, label))) return false;
        if (tokens.some((token) => !expertHaystack(card).includes(token.toLowerCase()))) return false;
        const rate = finiteRate(card.hourlyRate);
        if (rate === null) return false;
        if (under !== null && !(rate < under)) return false;
        if (over !== null && !(rate > over)) return false;
        return true;
    });

    if (cheapest && highest) {
        const lows = keepExtreme(matched, 'min');
        const low = finiteRate(lows[0]?.hourlyRate);
        const high = finiteRate(keepExtreme(matched, 'max')[0]?.hourlyRate);
        return low !== null && low === high ? lows : [];
    }
    if (cheapest) return keepExtreme(matched, 'min');
    if (highest) return keepExtreme(matched, 'max');
    return matched;
};

const finishSentence = (text: string): string => (text.endsWith('.') ? text : `${text}.`);

const joinClauses = (clauses: string[]): string => {
    if (clauses.length === 1) return finishSentence(clauses[0]);
    if (clauses.length === 2) return finishSentence(`${clauses[0]} and ${clauses[1]}`);
    return finishSentence(`${clauses.slice(0, -1).join(', ')}, and ${clauses[clauses.length - 1]}`);
};

const safeHost = (card: any): string => {
    const host = seminarHostName(card).trim();
    if (!host || host.includes('@')) return '';
    return host;
};

export const publicFactTemplate = (cards: any[]): string => {
    const winners = Array.isArray(cards) ? cards : [];
    if (!winners.length) return EMPTY_PUBLIC_FACT;
    const seminarFacts = winners.every((card) => card?.seats != null && finiteRate(card?.hourlyRate) === null);
    if (seminarFacts) {
        const clauses = winners.map((card) => {
            const name = String(card?.name ?? '').trim() || 'A seminar';
            const price = finiteRate(card?.price);
            const shown = price === null ? 'no public price' : `$${formatRate(price)}`;
            const seats = String(card?.seats ?? '').trim();
            const host = safeHost(card);
            const seatText = seats ? ` Seats: ${seats}.` : '';
            const hostText = host ? ` Host: ${host}.` : '';
            return `${name} costs ${shown}.${seatText}${hostText}`;
        });
        return joinClauses(clauses);
    }
    const clauses = winners.map((card) => {
        const name = String(card?.name ?? '').trim() || 'An expert';
        const rate = finiteRate(card?.hourlyRate);
        const shown = rate === null ? 'an unpublished rate' : formatRate(rate);
        return `${name} has a public hourly rate of ${shown}`;
    });
    return joinClauses(clauses);
};

const seminarHostName = (card: any): string => {
    const host = card?.host;
    const admin = card?.admin;
    const direct = card?.hostName
        ?? host?.username
        ?? host?.name
        ?? (typeof host === 'string' ? host : undefined)
        ?? admin?.username
        ?? admin?.name;
    return String(direct ?? '');
};

const seminarTokens = (question: string): string[] => {
    const tokens: string[] = [];
    const cjk = String(question ?? '').match(/[\u3400-\u9fff]{2,}/g) || [];
    cjk.forEach((token) => tokens.push(token));
    String(question ?? '')
        .split(/[^A-Za-z0-9]+/)
        .forEach((word) => {
            if (word.length < 2) return;
            if (SEMINAR_STOPWORDS.has(word.toLowerCase())) return;
            tokens.push(word);
        });
    return tokens;
};

const SEMINAR_PRICE_TOKEN = /^(?:price|prices|cost|costs|fee|fees|seats?|cheapest|highest|under|over)$/i;

const scrubSeminar = (card: any): any => {
    const next = { ...card };
    delete next.host;
    delete next.admin;
    delete next.image;
    delete next.hostImage;
    const host = safeHost(card);
    if (host) next.hostName = host;
    else delete next.hostName;
    return next;
};

export const filterPublicSeminars = (cards: any[], question: string): any[] => {
    const asked = String(question ?? '');
    const tokens = seminarTokens(asked).filter((token) => !SEMINAR_PRICE_TOKEN.test(token));
    const pool = (Array.isArray(cards) ? cards : []).filter((card) => card && typeof card === 'object');
    const named = tokens.length
        ? pool.filter((card) => {
            const haystack = `${card.name ?? ''} ${card.description ?? ''}`.toLowerCase();
            return tokens.every((token) => haystack.includes(token.toLowerCase()));
        })
        : pool;
    const priced = named.filter((card) => finiteRate(card.price) !== null);
    const cheapest = /最便宜|\bcheapest\b/i.test(asked);
    const highest = /最贵|\bhighest\b/i.test(asked);
    const under = /\bunder\b/i.test(asked) ? numberAfter(asked, 'under') : null;
    const over = /\bover\b/i.test(asked) ? numberAfter(asked, 'over') : null;
    const bounded = priced.filter((card) => {
        const price = finiteRate(card.price);
        if (price === null) return false;
        if (under !== null && !(price < under)) return false;
        if (over !== null && !(price > over)) return false;
        return true;
    });
    const ranked = cheapest
        ? keepExtreme(bounded.map((card) => ({ ...card, hourlyRate: finiteRate(card.price) })), 'min')
        : highest
            ? keepExtreme(bounded.map((card) => ({ ...card, hourlyRate: finiteRate(card.price) })), 'max')
            : bounded;
    return ranked.map((card) => {
        const next = scrubSeminar(card);
        delete next.hourlyRate;
        if (finiteRate(card.price) !== null) next.price = finiteRate(card.price);
        return next;
    });
};

const recordId = (value: unknown): string => {
    if (value == null) return '';
    if (typeof value === 'object') {
        const record = value as { _id?: unknown; id?: unknown };
        return String(record._id ?? record.id ?? '').trim();
    }
    return String(value).trim();
};

const recordIds = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value.map((item) => recordId(item)).filter(Boolean);
};

const toOwnRecord = (row: any): any => {
    const out: any = {};
    OWN_RECORD_FIELDS.forEach((key) => {
        if (row[key] !== undefined) out[key] = row[key];
    });
    if (typeof out.hostName === 'string' && out.hostName.includes('@')) delete out.hostName;
    if (Array.isArray(out.participantNames)) {
        out.participantNames = out.participantNames.filter((name: unknown) => !String(name).includes('@'));
    }
    return out;
};

const endInFuture = (value: unknown, now: number): boolean => {
    const ms = new Date(value as any).getTime();
    return Number.isFinite(ms) && ms > now;
};

const rowKind = (row: any): string => {
    const kind = String(row?.kind ?? '').trim();
    if (kind === 'legacyEvent' || kind === 'seatRequest') return kind;
    return String(row?.type ?? '').trim().toLowerCase();
};

export const filterOwnRecords = (rows: any[], caller: any, question?: string): any[] => {
    const callerId = recordId(caller?.id ?? caller?.userId ?? caller?._id);
    const role = String(caller?.role ?? '').trim().toLowerCase();
    const asked = String(question ?? caller?.question ?? '');
    const upcoming = /\bupcoming\b|\bmy\s+next\b/i.test(asked);
    const wantSeminar = /\bseminars?\b/i.test(asked);
    const wantMeeting = /\b(?:meetings?|1:1s?|one-on-ones?|one\s+on\s+ones?)\b/i.test(asked);
    const wantCommunity = /\bcommunit(?:y|ies)\b/i.test(asked);
    const wantLegacy = /\bevents?\b/i.test(asked);
    const narrowed = wantSeminar || wantMeeting || wantCommunity || wantLegacy;
    const now = Date.now();

    return (Array.isArray(rows) ? rows : []).filter((row) => {
        if (!row || typeof row !== 'object') return false;
        const status = String(row.status ?? '').trim().toLowerCase();
        if (status === 'cancelled' || status === 'canceled' || status === 'declined' || status === 'draft') {
            return false;
        }
        const kind = rowKind(row);
        if (narrowed) {
            const allowed = (wantSeminar && kind === 'seminar')
                || (wantMeeting && (kind === 'individual' || kind === 'seminar'))
                || (wantCommunity && kind === 'community')
                || (wantLegacy && kind === 'legacyEvent');
            if (!allowed) return false;
        }
        const expertId = recordId(row.expertId ?? row.expert);
        const customerId = recordId(row.customerId ?? row.customer);
        let party = false;
        if (kind === 'legacyEvent') {
            party = role === 'expert'
                ? expertId !== '' && expertId === callerId
                : role === 'customer' && customerId !== '' && customerId === callerId;
        } else if (kind === 'seatRequest') {
            party = role === 'expert'
                ? expertId !== '' && expertId === callerId
                : role === 'customer' && customerId !== '' && customerId === callerId;
        } else {
            const adminId = recordId(row.adminId ?? row.admin);
            const participantIds = recordIds(row.participantIds ?? row.participants);
            const isAdmin = callerId !== '' && adminId === callerId;
            const isParticipant = callerId !== '' && participantIds.includes(callerId);
            if (!isAdmin && !isParticipant) return false;
            if (role === 'customer') {
                if (kind === 'community') {
                    if (!isParticipant) return false;
                } else if (kind !== 'individual' && kind !== 'seminar') {
                    return false;
                }
            }
            party = true;
        }
        if (!party) return false;
        if (upcoming) {
            if (status !== 'pending' && status !== 'active') return false;
            if (!endInFuture(row.end, now)) return false;
        }
        return true;
    }).map(toOwnRecord);
};
