// services/fetchImageService.js
const axios = require("axios");

const getImage = async (file, folder) => {
    try {
        const apiUrl = `https://faas-nyc1-2ef2e6cc.doserverless.co/api/v1/web/fn-de24ea01-bfb2-4672-9e1c-82d2f1b3000a/package1/imageFetch?file=${file}&size=${folder}`;
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
