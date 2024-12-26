const axios = require("axios");
const FormData = require("form-data");

exports.uploadImageToStorage = async (file) => {
    try {
        const formData = new FormData();
        formData.append("image", file.buffer, {
            filename: file.originalname,
            contentType: file.mimetype
        });

        const response = await axios.post(
            `${process.env.AWS_URL}/upload`,
            formData,
            {
                headers: {
                    ...formData.getHeaders()
                }
            }
        );

        return response.data;
    } catch (error) {
        console.error("Error uploading to storage API:", error);
        throw new Error("Image upload failed.");
    }
};
