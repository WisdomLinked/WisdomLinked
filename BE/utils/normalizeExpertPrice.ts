/** Same rule as FE/src/utils/schedulingSlots.ts normalizeExpertPrice. */
export function normalizeExpertPrice(price: unknown): number | undefined {
    if (typeof price === 'number' && !Number.isNaN(price)) return price;
    if (Array.isArray(price) && price.length > 0) {
        const n = Number(price[0]);
        return Number.isNaN(n) ? undefined : n;
    }
    return undefined;
}
