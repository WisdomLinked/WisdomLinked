import { loadPricingSettings } from '../utils/pricingSettings';
import {
    normalizeChequeNumber,
    parseChequeDate,
    parseYearMonth,
    payrollLiveNetCents,
    utcMonthRange,
} from '../utils/expertPayroll';
import type { CommissionRates } from '../utils/paymentSummary';

const mongoose = require('mongoose');
const PaymentHistory = require('../models/PaymentHistory');
const PayrollCheque = require('../models/PayrollCheque');
const User = require('../models/User');

const expertIdOf = (value: any) => {
    if (!value) return '';
    if (typeof value === 'object' && value._id) return String(value._id);
    return String(value);
};

const commissionRates = async (): Promise<CommissionRates> => {
    const settings = await loadPricingSettings();
    return {
        seminarCommissionPercent: settings.seminar.expertCommissionPercent,
        oneToOneCommissionPercent: settings.oneToOne.expertCommissionPercent,
    };
};

const PAYROLL_STATUSES = ['completed', 'refunded'];

const findPaymentRows = async (filter: Record<string, unknown>) => {
    const rows = await PaymentHistory.find(filter).lean();
    return rows || [];
};

/**
 * Rows that decide one UTC month's live net.
 * Charges are the ones created in the month. Refund rows are subtracted when they
 * belong to those charges, even if the refund itself was recorded later.
 * A refund dated in this month for another month's charge is left for that charge's month.
 */
const rowsForPayrollMonth = async (range: { start: Date; end: Date }, expertId?: string) => {
    const monthRows = await findPaymentRows({
        ...(expertId ? { expert: expertId } : { expert: { $exists: true, $ne: null } }),
        createdAt: { $gte: range.start, $lt: range.end },
        status: { $in: PAYROLL_STATUSES },
    });
    const chargeIntents = new Set(
        monthRows
            .filter((row: any) => row?.paymentType !== 'refund' && row?.paymentIntent)
            .map((row: any) => String(row.paymentIntent)),
    );
    const kept = monthRows.filter((row: any) => {
        if (row?.paymentType !== 'refund') return true;
        if (!row?.paymentIntent) return true;
        return chargeIntents.has(String(row.paymentIntent));
    });
    if (!chargeIntents.size) return kept;
    const linkedRefunds = await findPaymentRows({
        paymentType: 'refund',
        paymentIntent: { $in: [...chargeIntents] },
        status: { $in: PAYROLL_STATUSES },
    });
    const merged: any[] = [];
    const seen = new Set<string>();
    for (const row of [...kept, ...linkedRefunds]) {
        const key = row?._id
            ? `id:${row._id}`
            : [
                row?.paymentType,
                row?.paymentIntent,
                row?.amount,
                row?.status,
                row?.createdAt ? new Date(row.createdAt).toISOString() : '',
                expertIdOf(row?.expert),
            ].join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(row);
    }
    return merged;
};

const liveNetForExpertMonth = async (expertId: string, year: number, month: number, rates: CommissionRates) => {
    const range = utcMonthRange(year, month);
    if (!range) return 0;
    const rows = await rowsForPayrollMonth(range, expertId);
    return payrollLiveNetCents(rows, rates);
};

const usersById = async (ids: string[]) => {
    if (!ids.length) return new Map<string, any>();
    const users = await User.find({ _id: { $in: ids } }).select('username email').lean();
    const map = new Map<string, any>();
    for (const user of users || []) map.set(String(user._id), user);
    return map;
};

const chequeFields = (cheque: any) => ({
    _id: String(cheque._id),
    expertId: expertIdOf(cheque.expert),
    year: cheque.year,
    month: cheque.month,
    amountCents: cheque.amountCents,
    chequeNumber: cheque.chequeNumber,
    chequeDate: cheque.chequeDate,
    recordedBy: expertIdOf(cheque.recordedBy),
});

const readChequeDetails = (body: any) => {
    const chequeNumber = normalizeChequeNumber(body?.chequeNumber);
    if (!chequeNumber) return { error: 'Cheque number is required.' };
    if (chequeNumber.length > 80) return { error: 'Cheque number is too long.' };
    const chequeDate = parseChequeDate(body?.chequeDate);
    if (!chequeDate) return { error: 'Cheque date is required.' };
    return { chequeNumber, chequeDate };
};

const listPayroll = async (req, res) => {
    try {
        const period = parseYearMonth(req.query?.year, req.query?.month);
        if (!period) return res.status(400).send({ error: 'Choose a payroll month.' });
        const range = utcMonthRange(period.year, period.month);
        if (!range) return res.status(400).send({ error: 'Choose a payroll month.' });

        const rates = await commissionRates();
        const monthRows = await rowsForPayrollMonth(range);
        const rowsByExpert = new Map<string, any[]>();
        for (const row of monthRows) {
            const expertId = expertIdOf(row?.expert);
            if (!expertId) continue;
            const bucket = rowsByExpert.get(expertId) || [];
            bucket.push(row);
            rowsByExpert.set(expertId, bucket);
        }
        const liveByExpert = new Map<string, number>();
        for (const [expertId, expertRows] of rowsByExpert) {
            liveByExpert.set(expertId, payrollLiveNetCents(expertRows, rates));
        }

        const cheques = await PayrollCheque.find({ year: period.year, month: period.month }).lean();
        const chequeByExpert = new Map<string, any>();
        for (const cheque of cheques || []) chequeByExpert.set(expertIdOf(cheque.expert), cheque);

        const expertIds = new Set<string>([...liveByExpert.keys(), ...chequeByExpert.keys()]);
        const users = await usersById([...expertIds]);
        const rows = [...expertIds]
            .map((expertId) => {
                const liveNetCents = liveByExpert.get(expertId) || 0;
                const cheque = chequeByExpert.get(expertId) || null;
                if (!(liveNetCents > 0) && !cheque) return null;
                const user = users.get(expertId);
                const amountCents = cheque ? Number(cheque.amountCents) || 0 : liveNetCents;
                return {
                    expertId,
                    expertName: user?.username || user?.email || 'Expert',
                    expertEmail: user?.email || '',
                    liveNetCents,
                    status: cheque ? 'paid' : 'unpaid',
                    amountCents,
                    differenceCents: cheque ? liveNetCents - amountCents : 0,
                    cheque: cheque ? chequeFields(cheque) : null,
                };
            })
            .filter(Boolean)
            .sort((a: any, b: any) => String(a.expertName).localeCompare(String(b.expertName)));

        return res.send({
            year: period.year,
            month: period.month,
            timeZone: 'UTC',
            rows,
        });
    } catch (err) {
        console.log(err);
        return res.status(500).send({ error: 'Something went wrong. Please try again.' });
    }
};

const recordPayrollCheque = async (req, res) => {
    try {
        const expertId = expertIdOf(req.body?.expertId);
        if (!mongoose.Types.ObjectId.isValid(expertId)) {
            return res.status(400).send({ error: 'Choose an expert.' });
        }
        const period = parseYearMonth(req.body?.year, req.body?.month);
        if (!period) return res.status(400).send({ error: 'Choose a payroll month.' });
        const details = readChequeDetails(req.body);
        if ('error' in details) return res.status(400).send({ error: details.error });

        const rates = await commissionRates();
        const liveNetCents = await liveNetForExpertMonth(expertId, period.year, period.month, rates);
        if (!(liveNetCents > 0)) {
            return res.status(400).send({ error: 'This month has nothing to pay.' });
        }

        const existing = await PayrollCheque.findOne({
            expert: expertId,
            year: period.year,
            month: period.month,
        });
        if (existing) {
            return res.status(409).send({ error: 'A cheque is already recorded for this expert and month.' });
        }

        const recordedBy = expertIdOf(req.user?.userId);
        let created;
        try {
            created = await PayrollCheque.create({
                expert: expertId,
                year: period.year,
                month: period.month,
                amountCents: liveNetCents,
                chequeNumber: details.chequeNumber,
                chequeDate: details.chequeDate,
                recordedBy,
            });
        } catch (err: any) {
            if (err?.code === 11000) {
                return res.status(409).send({ error: 'A cheque is already recorded for this expert and month.' });
            }
            throw err;
        }

        return res.status(201).send({
            ...chequeFields(created),
            liveNetCents,
            status: 'paid',
            differenceCents: 0,
        });
    } catch (err) {
        console.log(err);
        return res.status(500).send({ error: 'Something went wrong. Please try again.' });
    }
};

const updatePayrollCheque = async (req, res) => {
    try {
        const details = readChequeDetails(req.body);
        if ('error' in details) return res.status(400).send({ error: details.error });
        const updated = await PayrollCheque.findByIdAndUpdate(
            req.params?.id,
            { $set: { chequeNumber: details.chequeNumber, chequeDate: details.chequeDate } },
            { new: true },
        );
        if (!updated) return res.status(404).send({ error: 'Cheque not found.' });

        const rates = await commissionRates();
        const liveNetCents = await liveNetForExpertMonth(
            expertIdOf(updated.expert),
            Number(updated.year),
            Number(updated.month),
            rates,
        );
        const amountCents = Number(updated.amountCents) || 0;
        return res.send({
            ...chequeFields(updated),
            liveNetCents,
            status: 'paid',
            differenceCents: liveNetCents - amountCents,
        });
    } catch (err) {
        console.log(err);
        return res.status(500).send({ error: 'Something went wrong. Please try again.' });
    }
};

const listExpertPayroll = async (req, res) => {
    try {
        const expertId = expertIdOf(req.params?.expertId);
        if (!mongoose.Types.ObjectId.isValid(expertId)) {
            return res.status(400).send({ error: 'Choose an expert.' });
        }
        const cheques = await PayrollCheque.find({ expert: expertId }).lean();
        return res.send({
            cheques: (cheques || []).map(chequeFields),
        });
    } catch (err) {
        console.log(err);
        return res.status(500).send({ error: 'Something went wrong. Please try again.' });
    }
};

module.exports = {
    listPayroll,
    recordPayrollCheque,
    updatePayrollCheque,
    listExpertPayroll,
};
