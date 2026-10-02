const mongoose = require('mongoose');

const featuredExpertSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        title: { type: String, required: true },
        organization: { type: String, required: true },
        type: { type: String, enum: ['academic', 'industry'], required: true },
        photoUrl: { type: String, default: '' },
        order: { type: Number, default: 0 },
        active: { type: Boolean, default: true },
    },
    { timestamps: true },
);

featuredExpertSchema.index({ order: 1 });

module.exports = mongoose.model('FeaturedExpert', featuredExpertSchema);
