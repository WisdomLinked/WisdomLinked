const { PutObjectCommand } = require("@aws-sdk/client-s3");
const s3 = require("./spacesClient");
const FormData = require("form-data");

exports.uploadImageToStorage = async (file) => {
    const fileName = `profile/${Date.now()}-${file.originalname}`;
  
    const uploadParams = {
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: "public-read",
    };
  
    await s3.send(new PutObjectCommand(uploadParams));
  
    const publicUrl = `${process.env.DO_SPACES_ENDPOINT.replace(
      "https://",
      `https://${process.env.DO_SPACES_BUCKET}.`
    )}/${fileName}`;
    return publicUrl;
  };
