const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  endpoint: process.env.DO_SPACES_ENDPOINT,
  accessKeyId: process.env.DO_SPACES_KEY,
  secretAccessKey: process.env.DO_SPACES_SECRET,
  region: 'us-east-1',
});

module.exports = async (req: any, res: any) => {
  try {
    const bucketName = process.env.DO_SPACES_BUCKET;
    const { file, size } = req.query;

    if (!file || !size) {
      return res.status(400).json({ error: "'file' and 'size' query parameters are required." });
    }

    const s3Key = `${size}/${file}`;
    const data = await s3.getObject({ Bucket: bucketName, Key: s3Key }).promise();

    res.setHeader("Content-Type", data.ContentType || "application/octet-stream");
    res.send(data.Body);
  } catch (error: any) {
    console.error("Error fetching image from Spaces:", error);
    res.status(500).json({ error: error.message });
  }
};

export {};