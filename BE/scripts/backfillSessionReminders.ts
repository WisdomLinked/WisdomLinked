/**
 * One-shot: suppress the first-run reminder burst.
 *
 * Every session that already exists has an empty `remindersSent`, so the first
 * sweep after deploy would treat each one as never-reminded and email everyone
 * whose session starts within the next 24 hours — all at once, unannounced.
 *
 * This marks those already-inside-the-window sessions as reminded, so the sweep
 * starts clean and only handles marks that pass from here on.
 *
 * Run ONCE per environment, immediately before or after deploying the sweep.
 *
 * Deliberately a script and not a check inside the sweep: a boot-time suppressor
 * would run again on every restart and would silently swallow a legitimate
 * 15-minute reminder for a session that happened to be imminent at that moment.
 *
 *   cd BE && npx tsx scripts/backfillSessionReminders.ts --dry-run
 *   cd BE && npx tsx scripts/backfillSessionReminders.ts
 */
require("dotenv").config();

const mongoose = require("mongoose");

const GroupChat = require("../models/GroupChat");
const Event = require("../models/Event");
const { REMINDER_LEAD_MS } = require("../utils/sessionReminders");
const { REMINDABLE_GROUP_TYPES } = require("../services/sessionReminderSweep");

const DRY_RUN = process.argv.includes("--dry-run");

const run = async () => {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error("MONGO_URI is not set.");
        process.exit(1);
    }
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000 });

    const now = Date.now();
    // Anything starting inside the longest lead time already has a passed mark.
    const horizon = new Date(now + REMINDER_LEAD_MS["24h"]);
    const from = new Date(now);

    const groupFilter = {
        type: { $in: REMINDABLE_GROUP_TYPES },
        status: "active",
        start: { $gt: from, $lte: horizon },
        remindersSent: { $size: 0 },
    };
    const eventFilter = {
        status: "accepted",
        start: { $gt: from, $lte: horizon },
        remindersSent: { $size: 0 },
    };

    const groups = await GroupChat.find(groupFilter).select("name type start");
    const events = await Event.find(eventFilter).select("title start");

    console.log(`Sessions starting before ${horizon.toISOString()} with no reminder history:`);
    console.log(`  GroupChat (seminar + 1:1): ${groups.length}`);
    console.log(`  Event (legacy 1:1):        ${events.length}`);

    if (!groups.length && !events.length) {
        console.log("Nothing to suppress.");
        await mongoose.disconnect();
        return;
    }

    for (const g of groups) console.log(`    [${g.type}] ${g.name} — ${new Date(g.start).toISOString()}`);
    for (const e of events) console.log(`    [event] ${e.title || "(untitled)"} — ${new Date(e.start).toISOString()}`);

    if (DRY_RUN) {
        console.log("\n--dry-run: nothing written.");
        await mongoose.disconnect();
        return;
    }

    // Mark both kinds: a session inside 24h has passed its 24h mark, and one inside
    // 15 minutes has passed both. Marking both is the conservative choice — the point
    // is that this deploy sends nothing for sessions already under way.
    const both = ["24h", "15m"];
    const g = await GroupChat.updateMany(groupFilter, { $set: { remindersSent: both } });
    const e = await Event.updateMany(eventFilter, { $set: { remindersSent: both } });

    console.log(`\nSuppressed: ${g.modifiedCount} group session(s), ${e.modifiedCount} event(s).`);
    console.log("The sweep will now only act on marks that pass from here on.");
    await mongoose.disconnect();
};

run().catch(async (err) => {
    console.error("backfillSessionReminders failed:", err?.message || err);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
});
