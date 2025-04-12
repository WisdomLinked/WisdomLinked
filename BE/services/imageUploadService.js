const axios = require("axios");
const FormData = require("form-data");

exports.uploadImageToStorage = async (file) => {
    try {
        const formData = new FormData();
        formData.append("image", file.buffer, {
            filename: file.originalname,
            contentType: file.mimetype
        });

        console.log("Uploading:", file.originalname);
        const response = await axios.post(
            `https://faas-nyc1-2ef2e6cc.doserverless.co/api/v1/web/fn-de24ea01-bfb2-4672-9e1c-82d2f1b3000a/package1/imageUpload`,
            formData,
            {
                headers: {
                    ...formData.getHeaders()
                }
            }
        );
        console.log(" Upload complete, triggering resize");
        await axios.get(`https://faas-nyc1-2ef2e6cc.doserverless.co/api/v1/web/fn-de24ea01-bfb2-4672-9e1c-82d2f1b3000a/package1/imageResize?key=originals/${file.originalname}`);

        return response.data;
    } catch (error) {
        console.error("Error uploading to storage API:", error);
        throw new Error(error.response.data.error || "Failed to upload image");
    }
};
