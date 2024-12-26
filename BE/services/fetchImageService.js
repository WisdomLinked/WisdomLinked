// services/fetchImageService.js
const axios = require("axios");

const getImage = async (file, folder) => {
    try {
        const apiUrl = `https://b7xoehtvlk.execute-api.ap-south-1.amazonaws.com/getImage?file=${file}&size=${folder}`;
        const response = await axios.get(apiUrl, {
            responseType: "arraybuffer",
            headers: {
                'Accept': 'image/*'
            }
        });

        return {
            data: response.data,
            contentType: response.headers['content-type']
        };
    } catch (error) {
        console.error("Error in fetchImageService:", error);
        throw new Error("Unable to fetch image from API.");
    }
};

module.exports = { getImage };
