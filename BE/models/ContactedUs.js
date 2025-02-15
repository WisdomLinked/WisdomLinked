const mongoose = require('mongoose');

const ContactedUsSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    countryCode: {
        type: String
    },
    contactNumber: {
        type: String
    },
    issue: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("ContactedUs", ContactedUsSchema);
