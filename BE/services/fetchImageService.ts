import axios from "axios";
import { getProfileImageFromSpaces, isProfileImageStorageConfigured } from "./profileImageStorage";

const FAAS_FETCH_BASE =
  "https://faas-nyc1-2ef2e6cc.doserverless.co/api/v1/web/fn-de24ea01-bfb2-4672-9e1c-82d2f1b3000a/package1/imageFetch";

const getImage = async (file: string, folder: string) => {
  if (isProfileImageStorageConfigured()) {
    const fromSpaces = await getProfileImageFromSpaces(file, folder);
    if (fromSpaces) {
      return fromSpaces;
    }
  }

  try {
    const apiUrl = `${FAAS_FETCH_BASE}?file=${encodeURIComponent(file)}&size=${encodeURIComponent(folder)}`;
    const response = await axios.get(apiUrl, {
      responseType: "arraybuffer",
      headers: { Accept: "image/*" },
      timeout: 30000,
    });

    return {
      data: response.data,
      contentType: response.headers["content-type"],
    };
  } catch (error) {
    console.error("Error in fetchImageService:", error);
    throw new Error("Unable to fetch image from API.");
  }
};

module.exports = { getImage };
