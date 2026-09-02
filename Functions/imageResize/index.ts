const AWS = require('aws-sdk');
const sharp = require('sharp');

const s3 = new AWS.S3({
  endpoint: process.env.DO_SPACES_ENDPOINT,
  accessKeyId: process.env.DO_SPACES_KEY,
  secretAccessKey: process.env.DO_SPACES_SECRET,
  region: 'us-east-1',
});

const sizes = [
  { name: "small", width: 150 },
  { name: "medium", width: 300 },
  { name: "large", width: 900 },
];

module.exports = async (req: any, res: any) => {
  try {
    const { key } = req.query;
    const bucket = process.env.DO_SPACES_BUCKET;

    if (!key) {
      return res.status(400).json({ error: "'key' query parameter is required" });
    }

    const decodedKey = decodeURIComponent(key.replace(/\+/g, " "));
    const originalObject = await s3.getObject({ Bucket: bucket, Key: decodedKey }).promise();
    const imageBuffer = originalObject.Body;

    const resizePromises = sizes.map(async ({ name, width }) => {
      const resizedImageBuffer = await sharp(imageBuffer)
        .resize({ width })
        .withMetadata()
        .toBuffer();

      const resizedKey = `${name}/${decodedKey}`;

      await s3.putObject({
        Bucket: bucket,
        Key: resizedKey,
        Body: resizedImageBuffer,
        ContentType: originalObject.ContentType,
      }).promise();
    });

    await Promise.all(resizePromises);

    res.status(200).json({ message: "Images resized and uploaded successfully." });
  } catch (err: any) {
    console.error("Error resizing image:", err);
    res.status(500).json({ error: err.message });
  }
};

export {};