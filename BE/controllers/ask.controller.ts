import { safeErrorMessage } from '../utils/httpUserFacingCopy';
import {
    hasRealAnswer,
    postFilterAnswer,
    qaRolesForCaller,
    selectSimilarQuestions,
} from '../utils/askGrounding';
import { runAskAgent } from '../utils/askAgent';

const chatBotQA = require('../models/chatBotQA');
const searchController = require('./search.controller');
const { PENDING_ANSWER } = require('./chatBotQA.controller');

const ANSWERS_UNAVAILABLE = 'Answers are unavailable right now.';
const MAX_PRIOR_MESSAGES = 8;

const modelAccessKey = (): string => String(process.env.GRADIENT_MODEL_ACCESS_KEY || '').trim();

const isTurn = (message: any): boolean =>
    Boolean(message)
    && (message.role === 'user' || message.role === 'assistant')
    && typeof message.content === 'string';

/** Prior turns are capped at 8. `question` is the latest user turn. A messages-only body uses its last user turn. */
const readTurns = (body: any): { question: string; messages: { role: string; content: string }[] } => {
    const provided = (Array.isArray(body?.messages) ? body.messages : [])
        .filter(isTurn)
        .map((message: any) => ({ role: String(message.role), content: String(message.content) }));
    const explicit = typeof body?.question === 'string' ? body.question.trim() : '';
    if (explicit) {
        return {
            question: explicit,
            messages: [...provided.slice(-MAX_PRIOR_MESSAGES), { role: 'user', content: explicit }],
        };
    }
    let lastUser = -1;
    for (let index = provided.length - 1; index >= 0; index -= 1) {
        if (provided[index].role === 'user' && provided[index].content.trim()) {
            lastUser = index;
            break;
        }
    }
    if (lastUser < 0) return { question: '', messages: [] };
    const question = provided[lastUser].content.trim();
    const prior = provided.slice(0, lastUser).slice(-MAX_PRIOR_MESSAGES);
    return { question, messages: [...prior, { role: 'user', content: question }] };
};

const loadSimilarQuestions = async (user: any, question: string) => {
    const roles = qaRolesForCaller(user);
    const found = await chatBotQA.find({ role: { $in: roles } }).select('question answer role').lean();
    const rows = (Array.isArray(found) ? found : []).filter((row) => hasRealAnswer(row, PENDING_ANSWER));
    return selectSimilarQuestions(rows, question, 4);
};

const respond = (res, answer: string, cards: any, similarQuestions: any[] = []) =>
    res.status(200).json({
        answer,
        citations: [],
        similarQuestions: similarQuestions.slice(0, 4),
        experts: cards.experts,
        seminars: cards.seminars,
        students: cards.students,
        yours: cards.yours,
        pages: cards.pages,
    });

const ask = async (req, res) => {
    try {
        const { question, messages } = readTurns(req.body);
        const cards = await searchController.collectSearchResults(req, question);
        let similarQuestions: any[] = [];
        try {
            similarQuestions = await loadSimilarQuestions(req.user, question);
        } catch (_err) {
            similarQuestions = [];
        }

        const modelKey = modelAccessKey();
        if (!modelKey || !question) {
            return respond(res, ANSWERS_UNAVAILABLE, cards, similarQuestions);
        }

        let result: { answer: string; toolResultsText: string };
        try {
            result = await runAskAgent({
                messages,
                caller: req.user,
                modelKey,
            });
        } catch (_err) {
            console.error('[ask] inference failed');
            return respond(res, ANSWERS_UNAVAILABLE, cards, similarQuestions);
        }

        const filtered = postFilterAnswer(result.answer, result.toolResultsText);
        if (!filtered) {
            return respond(res, ANSWERS_UNAVAILABLE, cards, similarQuestions);
        }
        return respond(res, filtered, cards, similarQuestions);
    } catch (err) {
        console.error(err);
        return res.status(500).send(safeErrorMessage(err));
    }
};

module.exports = {
    ask,
    ANSWERS_UNAVAILABLE,
};
