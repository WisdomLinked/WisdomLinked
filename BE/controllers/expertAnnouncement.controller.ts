import { Response } from 'express';
import {
  DETAILS_MAX,
  feedContentChanged,
  getEffectiveStatus,
  isVisibleToStudents,
  toOwnerAnnouncement,
  toPublicAnnouncement,
  validateAnnouncementBody,
} from '../utils/expertAnnouncement';

const ExpertAnnouncement = require('../models/ExpertAnnouncement');
const ExpertAnnouncementReport = require('../models/ExpertAnnouncementReport');
const { safeErrorMessage } = require('../utils/httpUserFacingCopy');

const fieldErrorResponse = (res: Response, errors: { field: string; message: string }[]) =>
  res.status(400).json({ status: 'FAILED', errors });

async function expireIfNeeded(doc: any) {
  if (!doc) return doc;
  const effective = getEffectiveStatus(doc.status, doc.endsAt);
  if (doc.status === 'live' && effective === 'expired') {
    doc.status = 'expired';
    await doc.save();
  }
  return doc;
}

const getMyAnnouncement = async (req: any, res: Response) => {
  try {
    const expertId = String(req.user.userId);
    let doc = await ExpertAnnouncement.findOne({ expertId });
    doc = await expireIfNeeded(doc);
    return res.status(200).json({ announcement: toOwnerAnnouncement(doc) });
  } catch (err) {
    console.log('[getMyAnnouncement]', err);
    return res.status(500).send(safeErrorMessage(err));
  }
};

const createAnnouncement = async (req: any, res: Response) => {
  try {
    const expertId = String(req.user.userId);
    const existing = await ExpertAnnouncement.findOne({ expertId });
    if (existing) {
      return res.status(409).json({
        status: 'FAILED',
        errors: [{ field: 'general', message: 'You already have an announcement. Edit, repost, or delete it instead.' }],
      });
    }

    const now = new Date();
    const errors = validateAnnouncementBody(req.body || {}, now);
    if (errors.length) return fieldErrorResponse(res, errors);

    const visibility = String(req.body.visibility);
    const link = typeof req.body.link === 'string' && req.body.link.trim()
      ? req.body.link.trim()
      : undefined;

    const doc = await ExpertAnnouncement.create({
      expertId,
      title: String(req.body.title).trim(),
      message: String(req.body.message).trim(),
      type: String(req.body.type),
      link,
      visibility,
      feedReview: visibility === 'profile_and_feed' ? 'pending' : undefined,
      publishedAt: now,
      endsAt: new Date(String(req.body.endsAt)),
      status: 'live',
    });

    return res.status(201).json({ announcement: toOwnerAnnouncement(doc) });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({
        status: 'FAILED',
        errors: [{ field: 'general', message: 'You already have an announcement. Edit, repost, or delete it instead.' }],
      });
    }
    console.log('[createAnnouncement]', err);
    return res.status(500).send(safeErrorMessage(err));
  }
};

const updateAnnouncement = async (req: any, res: Response) => {
  try {
    const expertId = String(req.user.userId);
    let doc = await ExpertAnnouncement.findOne({ expertId });
    if (!doc) {
      return res.status(404).json({
        status: 'FAILED',
        errors: [{ field: 'general', message: 'No announcement found.' }],
      });
    }
    doc = await expireIfNeeded(doc);

    const now = new Date();
    const repost = Boolean(req.body?.repost);

    if (repost) {
      if (doc.status === 'live' && getEffectiveStatus(doc.status, doc.endsAt, now) === 'live') {
        return res.status(400).json({
          status: 'FAILED',
          errors: [{ field: 'general', message: 'This announcement is already live. Edit it instead.' }],
        });
      }
      const errors = validateAnnouncementBody(req.body || {}, now);
      if (errors.length) return fieldErrorResponse(res, errors);

      const visibility = String(req.body.visibility);
      const link = typeof req.body.link === 'string' && req.body.link.trim()
        ? req.body.link.trim()
        : undefined;

      doc.title = String(req.body.title).trim();
      doc.message = String(req.body.message).trim();
      doc.type = String(req.body.type);
      doc.link = link;
      doc.visibility = visibility;
      doc.feedReview = visibility === 'profile_and_feed' ? 'pending' : undefined;
      doc.publishedAt = now;
      doc.endsAt = new Date(String(req.body.endsAt));
      doc.status = 'live';
      await doc.save();
      return res.status(200).json({ announcement: toOwnerAnnouncement(doc) });
    }

    // Keep current endsAt when client omits it (duration "keep").
    const keepEndsAt = req.body?.endsAt == null || req.body?.endsAt === '';
    const errors = validateAnnouncementBody(
      {
        ...req.body,
        endsAt: keepEndsAt ? doc.endsAt.toISOString() : req.body.endsAt,
      },
      now,
    );
    if (errors.length) return fieldErrorResponse(res, errors);

    const nextTitle = String(req.body.title).trim();
    const nextMessage = String(req.body.message).trim();
    const nextLink = typeof req.body.link === 'string' && req.body.link.trim()
      ? req.body.link.trim()
      : undefined;
    const nextVisibility = String(req.body.visibility) as 'profile' | 'profile_and_feed';
    const nextType = String(req.body.type);

    const contentChanged = feedContentChanged(
      { title: nextTitle, message: nextMessage, link: nextLink },
      { title: doc.title, message: doc.message, link: doc.link },
    );

    doc.title = nextTitle;
    doc.message = nextMessage;
    doc.type = nextType;
    doc.link = nextLink;
    doc.visibility = nextVisibility;
    if (!keepEndsAt) doc.endsAt = new Date(String(req.body.endsAt));

    if (nextVisibility === 'profile_and_feed') {
      if (!doc.feedReview || contentChanged) doc.feedReview = 'pending';
    } else {
      doc.feedReview = undefined;
    }

    if (doc.status === 'expired') {
      // Editing an expired post without repost flag still updates draft fields but stays expired
      // unless they explicitly repost. Keep status as expired.
    } else if (doc.status === 'unpublished') {
      // Same — stay unpublished until repost.
    }

    await doc.save();
    return res.status(200).json({ announcement: toOwnerAnnouncement(doc) });
  } catch (err) {
    console.log('[updateAnnouncement]', err);
    return res.status(500).send(safeErrorMessage(err));
  }
};

const unpublishAnnouncement = async (req: any, res: Response) => {
  try {
    const expertId = String(req.user.userId);
    let doc = await ExpertAnnouncement.findOne({ expertId });
    if (!doc) {
      return res.status(404).json({
        status: 'FAILED',
        errors: [{ field: 'general', message: 'No announcement found.' }],
      });
    }
    doc = await expireIfNeeded(doc);
    if (doc.status !== 'live') {
      return res.status(400).json({
        status: 'FAILED',
        errors: [{ field: 'general', message: 'Only a live announcement can be unpublished.' }],
      });
    }
    doc.status = 'unpublished';
    await doc.save();
    return res.status(200).json({ announcement: toOwnerAnnouncement(doc) });
  } catch (err) {
    console.log('[unpublishAnnouncement]', err);
    return res.status(500).send(safeErrorMessage(err));
  }
};

const deleteAnnouncement = async (req: any, res: Response) => {
  try {
    const expertId = String(req.user.userId);
    const doc = await ExpertAnnouncement.findOneAndDelete({ expertId });
    if (!doc) {
      return res.status(404).json({
        status: 'FAILED',
        errors: [{ field: 'general', message: 'No announcement found.' }],
      });
    }
    await ExpertAnnouncementReport.deleteMany({ announcementId: doc._id });
    return res.status(200).json({ status: 'SUCCESS' });
  } catch (err) {
    console.log('[deleteAnnouncement]', err);
    return res.status(500).send(safeErrorMessage(err));
  }
};

const adminDeleteAnnouncement = async (req: any, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const doc = await ExpertAnnouncement.findByIdAndDelete(id);
    if (!doc) {
      return res.status(404).json({
        status: 'FAILED',
        errors: [{ field: 'general', message: 'No announcement found.' }],
      });
    }
    await ExpertAnnouncementReport.deleteMany({ announcementId: doc._id });
    return res.status(200).json({ status: 'SUCCESS' });
  } catch (err) {
    console.log('[adminDeleteAnnouncement]', err);
    return res.status(500).send(safeErrorMessage(err));
  }
};

const reportAnnouncement = async (req: any, res: Response) => {
  try {
    const reporterId = String(req.user.userId);
    const announcementId = String(req.params.id || '');
    const doc = await ExpertAnnouncement.findById(announcementId);
    if (!doc || !isVisibleToStudents(doc)) {
      return res.status(404).json({
        status: 'FAILED',
        errors: [{ field: 'general', message: 'Announcement not found.' }],
      });
    }
    if (String(doc.expertId) === reporterId) {
      return res.status(400).json({
        status: 'FAILED',
        errors: [{ field: 'general', message: 'You cannot report your own announcement.' }],
      });
    }

    const reason = String(req.body?.reason || '');
    const allowed = ExpertAnnouncementReport.REASON_ENUM as string[];
    if (!allowed.includes(reason)) {
      return fieldErrorResponse(res, [{ field: 'reason', message: 'Choose a reason.' }]);
    }
    const detailsRaw = typeof req.body?.details === 'string' ? req.body.details.trim() : '';
    if (detailsRaw.length > DETAILS_MAX) {
      return fieldErrorResponse(res, [{
        field: 'details',
        message: `Details can be at most ${DETAILS_MAX} characters.`,
      }]);
    }

    try {
      await ExpertAnnouncementReport.create({
        announcementId: doc._id,
        reporterId,
        reason,
        details: detailsRaw || undefined,
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        return res.status(409).json({
          status: 'FAILED',
          errors: [{ field: 'general', message: 'You already reported this post.' }],
        });
      }
      throw err;
    }

    return res.status(201).json({ status: 'SUCCESS' });
  } catch (err) {
    console.log('[reportAnnouncement]', err);
    return res.status(500).send(safeErrorMessage(err));
  }
};

const sweepExpiredExpertAnnouncements = async () => {
  try {
    const now = new Date();
    const result = await ExpertAnnouncement.updateMany(
      { status: 'live', endsAt: { $lte: now } },
      { $set: { status: 'expired' } },
    );
    if (result?.modifiedCount) {
      console.log('[sweepExpiredExpertAnnouncements] expired', result.modifiedCount);
    }
    return result?.modifiedCount || 0;
  } catch (err: any) {
    console.log('[sweepExpiredExpertAnnouncements]', err?.message || err);
    return 0;
  }
};

const loadPublicAnnouncementForExpert = async (expertId: string) => {
  const mongoose = require('mongoose');
  if (!expertId || !mongoose.isValidObjectId(String(expertId))) return null;
  const doc = await ExpertAnnouncement.findOne({ expertId: String(expertId) });
  if (!doc) return null;
  await expireIfNeeded(doc);
  return toPublicAnnouncement(doc);
};

module.exports = {
  getMyAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  unpublishAnnouncement,
  deleteAnnouncement,
  adminDeleteAnnouncement,
  reportAnnouncement,
  sweepExpiredExpertAnnouncements,
  loadPublicAnnouncementForExpert,
  toPublicAnnouncement,
};
