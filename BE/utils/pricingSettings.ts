import {
    computeSessionCharge,
    normalizePricingRates,
    validatePricingSettings,
    type ChargeBreakdown,
    type PricingRates,
    type PricingSessionType,
} from './bookingPrice';

const AppState = require('../models/AppState');

export type PricingSettings = {
    seminar: PricingRates;
    oneToOne: PricingRates;
};

export async function loadPricingSettings(): Promise<PricingSettings> {
    const appState = await AppState.findOne();
    return {
        seminar: normalizePricingRates(appState?.pricing?.seminar, 'seminar'),
        oneToOne: normalizePricingRates(appState?.pricing?.oneToOne, 'oneToOne'),
    };
}

export async function savePricingSettings(input: unknown): Promise<PricingSettings> {
    const parsed = validatePricingSettings(input);
    if (!parsed.ok) {
        const error = new Error(parsed.error) as Error & { status?: number };
        error.status = 400;
        throw error;
    }
    let appState = await AppState.findOne();
    if (!appState) {
        appState = await AppState.create({ pricing: { seminar: parsed.seminar, oneToOne: parsed.oneToOne } });
    } else {
        appState.pricing = { seminar: parsed.seminar, oneToOne: parsed.oneToOne };
        appState.markModified('pricing');
        await appState.save();
    }
    return { seminar: parsed.seminar, oneToOne: parsed.oneToOne };
}

export async function chargeForAdvertised(
    sessionType: PricingSessionType,
    advertisedCents: number,
): Promise<ChargeBreakdown> {
    const settings = await loadPricingSettings();
    return computeSessionCharge(advertisedCents, settings[sessionType], sessionType);
}
