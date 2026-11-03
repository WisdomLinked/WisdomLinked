const mongoose = require('mongoose');

const TYPE_ENUM = ['funded_ra', 'research_project', 'internship', 'workshop', 'other'];
const VISIBILITY_ENUM = ['profile', 'profile_and_feed'];
const FEED_REVIEW_ENUM = ['pending', 'approved', 'rejected'];
const STATUS_ENUM = ['live', 'unpublished', 'expired'];

const ExpertAnnouncementSchema = new mongoose.Schema(
  {
    expertId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    title: { type: String, required: true, maxlength: 80 },
    message: { type: String, required: true, maxlength: 400 },
    type: { type: String, enum: TYPE_ENUM, required: true },
    link: { type: String },
    visibility: { type: String, enum: VISIBILITY_ENUM, required: true, default: 'profile' },
    feedReview: { type: String, enum: FEED_REVIEW_ENUM },
    publishedAt: { type: Date, required: true },
    endsAt: { type: Date, required: true, index: true },
    status: { type: String, enum: STATUS_ENUM, required: true, default: 'live', index: true },
  },
  { timestamps: true },
);

ExpertAnnouncementSchema.index({ status: 1, endsAt: 1 });

module.exports = mongoose.model('ExpertAnnouncement', ExpertAnnouncementSchema);
module.exports.TYPE_ENUM = TYPE_ENUM;
module.exports.VISIBILITY_ENUM = VISIBILITY_ENUM;
module.exports.FEED_REVIEW_ENUM = FEED_REVIEW_ENUM;
module.exports.STATUS_ENUM = STATUS_ENUM;
