/**
 * Server-side booking window checks (availability slots, blocked dates, overlaps).
 */

const { normalizeAppointmentDurations } = require("./appointmentDurations");

function toYMDInTimeZone(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

function getSlotIndexInTimeZone(instant, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone || "UTC",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date(instant));

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 2 + (minute >= 30 ? 1 : 0);
}

function getSlotIndicesForRange(start, end, timeZone) {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    throw new Error("Invalid session time range");
  }

  const tz = timeZone || "UTC";
  const startDay = toYMDInTimeZone(start, tz);
  const indices = [];

  for (let t = startMs; t < endMs; t += 30 * 60 * 1000) {
    if (toYMDInTimeZone(t, tz) !== startDay) {
      throw new Error("Session must fall within a single calendar day in the expert's timezone");
    }
    const idx = getSlotIndexInTimeZone(t, tz);
    if (idx < 0 || idx > 47) {
      throw new Error("Session time is outside the bookable day window");
    }
    indices.push(idx);
  }

  return indices;
}

function assertSlotsInTimeSlots(expertDoc, start, end) {
  const allowed = Array.isArray(expertDoc?.timeSlots) ? expertDoc.timeSlots : [];
  if (!allowed.length) {
    throw new Error("Expert has no availability configured");
  }
  const tz = expertDoc?.timeZone || "UTC";
  const needed = getSlotIndicesForRange(start, end, tz);
  for (const idx of needed) {
    if (!allowed.includes(idx)) {
      throw new Error("Selected time is outside expert availability");
    }
  }
}

function assertNotBlockedDate(expertDoc, start) {
  const blocked = expertDoc?.blockedBookingDates;
  if (!Array.isArray(blocked) || !blocked.length) return;
  const ymd = toYMDInTimeZone(start, expertDoc?.timeZone || "UTC");
  if (blocked.includes(ymd)) {
    throw new Error("Expert is not accepting bookings on this date");
  }
}

function assertNotBlockedSlot(expertDoc, start, end) {
  const map = expertDoc?.blockedBookingSlots;
  if (!map) return;
  const tz = expertDoc?.timeZone || "UTC";
  const ymd = toYMDInTimeZone(start, tz);
  const blocked = map instanceof Map ? map.get(ymd) : map[ymd];
  if (!Array.isArray(blocked) || !blocked.length) return;
  const blockedSet = new Set(blocked);
  const needed = getSlotIndicesForRange(start, end, tz);
  for (const idx of needed) {
    if (blockedSet.has(idx)) {
      throw new Error("Expert is not available at the selected time on this date");
    }
  }
}

function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  const as = new Date(aStart).getTime();
  const ae = new Date(aEnd).getTime();
  const bs = new Date(bStart).getTime();
  const be = new Date(bEnd).getTime();
  return as < be && bs < ae;
}

async function assertNoBookingOverlap(expertId, start, end, options = {}) {
  const Event = require("../models/Event");
  const GroupChat = require("../models/GroupChat");
  const { excludeEventId, excludeGroupChatId } = options;

  const eventQuery = {
    expert: expertId,
    status: { $ne: "declined" },
  };
  if (excludeEventId) {
    eventQuery._id = { $ne: excludeEventId };
  }

  const events = await Event.find(eventQuery).select("start end status");
  for (const ev of events) {
    if (intervalsOverlap(start, end, ev.start, ev.end)) {
      throw new Error("Selected time conflicts with an existing booking");
    }
  }

  const chatQuery = {
    $or: [{ admin: expertId }, { participants: expertId }],
    status: { $in: ["pending", "active"] },
  };
  if (excludeGroupChatId) {
    chatQuery._id = { $ne: excludeGroupChatId };
  }

  const chats = await GroupChat.find(chatQuery).select("start end status type");
  for (const chat of chats) {
    if (intervalsOverlap(start, end, chat.start, chat.end)) {
      throw new Error("Selected time conflicts with an existing session");
    }
  }
}

function assertDurationAllowed(expertDoc, duration) {
  const allowed = normalizeAppointmentDurations(expertDoc?.appointmentDurations);
  const minutes = Number(duration);
  if (!allowed.includes(minutes)) {
    throw new Error("Expert does not offer sessions of this duration");
  }
}

async function assertBookingSlotValid(expertDoc, start, end, options = {}) {
  if (!options.allowOutsideAvailability) {
    assertNotBlockedDate(expertDoc, start);
    assertNotBlockedSlot(expertDoc, start, end);
    assertSlotsInTimeSlots(expertDoc, start, end);
  }
  const expertId = expertDoc._id || expertDoc.id;
  if (!expertId) {
    throw new Error("Expert not found");
  }
  await assertNoBookingOverlap(expertId, start, end, options);
}

module.exports = {
  toYMDInTimeZone,
  getSlotIndexInTimeZone,
  getSlotIndicesForRange,
  assertSlotsInTimeSlots,
  assertNotBlockedDate,
  assertNotBlockedSlot,
  intervalsOverlap,
  assertNoBookingOverlap,
  assertDurationAllowed,
  assertBookingSlotValid,
};
