const multer = require("multer");

const storage = multer.memoryStorage({
  destination: function (req, file, callback) {
    callback(null, "");
  },
});

const uploads = multer({ storage }).single("media");

module.exports = {
    uploads
};