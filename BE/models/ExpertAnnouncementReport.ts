const mongoose = require('mongoose');

const REASON_ENUM = ['spam', 'not_real', 'inappropriate', 'other'];

const ExpertAnnouncementReportSchema = new mongoose.Schema(
  {
    announcementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExpertAnnouncement',
      required: true,
      index: true,
    },
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reason: { type: String, enum: REASON_ENUM, required: true },
    details: { type: String, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

ExpertAnnouncementReportSchema.index(
  { announcementId: 1, reporterId: 1 },
  { unique: true },
);

module.exports = mongoose.model('ExpertAnnouncementReport', ExpertAnnouncementReportSchema);
module.exports.REASON_ENUM = REASON_ENUM;
