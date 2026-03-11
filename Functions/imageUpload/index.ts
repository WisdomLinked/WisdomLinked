const AWS = require('aws-sdk');
const Busboy = require('busboy');

const s3 = new AWS.S3({
  endpoint: process.env.DO_SPACES_ENDPOINT,
  accessKeyId: process.env.DO_SPACES_KEY,
  secretAccessKey: process.env.DO_SPACES_SECRET,
  region: 'us-east-1',
});

module.exports = async (req: any, res: any) => {
  const bucketName = process.env.DO_SPACES_BUCKET;

  const busboy = Busboy({ headers: req.headers });
  const fileUploads = [];
  const uploadPromises = [];

  busboy.on('file', (fieldname: any, file: any, info: any) => {
    const { filename, mimeType } = info;
    const chunks = [];

    file.on('data', (chunk: any) => chunks.push(chunk));

    file.on('end', () => {
      const fileContent = Buffer.concat(chunks);
      const key = `originals/${filename}`;

      const upload = s3.putObject({
        Bucket: bucketName,
        Key: key,
        Body: fileContent,
        ContentType: mimeType,
      }).promise()
        .then(() => fileUploads.push({ filename, status: 'uploaded' }))
        .catch((err: any) => fileUploads.push({ filename, status: 'failed', error: err.message }));

      uploadPromises.push(upload);
    });

    file.on('error', (err: any) => console.error('File stream error:', err));
  });

  busboy.on('finish', async () => {
    await Promise.all(uploadPromises);
    res.status(200).json({ message: 'Files processed', details: fileUploads });
  });

  req.pipe(busboy);
};

export {};