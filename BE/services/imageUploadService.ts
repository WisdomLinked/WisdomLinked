const axios = require("axios");
const FormData = require("form-data");
const {
  isProfileImageStorageConfigured,
  uploadProfileImageToSpaces,
} = require("./profileImageStorage");

const FAAS_UPLOAD_URL =
  "https://faas-nyc1-2ef2e6cc.doserverless.co/api/v1/web/fn-de24ea01-bfb2-4672-9e1c-82d2f1b3000a/package1/imageUpload";
const FAAS_RESIZE_URL =
  "https://faas-nyc1-2ef2e6cc.doserverless.co/api/v1/web/fn-de24ea01-bfb2-4672-9e1c-82d2f1b3000a/package1/imageResize";

async function uploadViaFaas(file: any) {
  const formData = new FormData();
  formData.append("image", file.buffer, {
    filename: file.originalname,
    contentType: file.mimetype,
  });

  const response = await axios.post(FAAS_UPLOAD_URL, formData, {
    headers: formData.getHeaders(),
    timeout: 60000,
  });

  try {
    await axios.get(`${FAAS_RESIZE_URL}?key=originals/${file.originalname}`, {
      timeout: 30000,
    });
  } catch (resizeErr: any) {
    console.warn("[imageUpload] FaaS resize skipped:", resizeErr?.message);
  }

  return response.data;
}

exports.uploadImageToStorage = async (file: any) => {
  if (isProfileImageStorageConfigured()) {
    try {
      return await uploadProfileImageToSpaces(file);
    } catch (directErr: any) {
      console.error("[imageUpload] Direct Spaces upload failed:", directErr?.message || directErr);
    }
  }

  try {
    return await uploadViaFaas(file);
  } catch (error: any) {
    console.error("Error uploading to storage API:", error);
    throw new Error(error?.response?.data?.error || error?.message || "Failed to upload image");
  }
};
