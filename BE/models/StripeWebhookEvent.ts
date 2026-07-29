const mongoose = require("mongoose");

// One row per Stripe event id, claimed before the event is processed. The unique index
// is what makes webhook delivery idempotent: a replay loses the insert and is acked
// without re-running any side effect. Rows expire after 30 days.
const StripeWebhookEventSchema = new mongoose.Schema(
    {
        eventId: { type: String, required: true, unique: true },
        type: { type: String },
        processedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
    },
    { timestamps: true }
);

module.exports = mongoose.model("StripeWebhookEvent", StripeWebhookEventSchema);
