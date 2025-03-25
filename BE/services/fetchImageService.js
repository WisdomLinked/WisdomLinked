// services/fetchImageService.js
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3 = new S3Client({
    endpoint: "https://nyc3.digitaloceanspaces.com", 
    region: "us-east-1",
    credentials: {
        accessKeyId: process.env.DO_SPACES_KEY,
        secretAccessKey: process.env.DO_SPACES_SECRET,
    },
});


const getImage = async (file, folder) => {
    try {
        const apiUrl = `${process.env.AWS_URL}/getImage?file=${file}&size=${folder}`;
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
