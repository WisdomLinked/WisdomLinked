import React from "react";
import ReactImagePickerEditor from 'react-image-picker-editor';
import 'react-image-picker-editor/dist/index.css'

const EditAvatar = ({ imageSrc, set_imageSrc, userId }: any) => {
    const handleImageChange = async (newDataUri: any) => {
        // Extract file extension from the data URI
        const fileExtension = newDataUri.split(';')[0].split('/')[1];
        console.log(newDataUri.split(';')[0].split(':')[1]);

        // Convert base64 to file
        const base64Response = await fetch(newDataUri);
        const blob = await base64Response.blob();
        const file = new File([blob], `${userId}.${fileExtension}`, { type: blob.type });

        // Create form data
        const formData = new FormData();
        formData.append('image', file);
        //console.log("formData", formData);

        try {
            const response = await fetch('http://localhost:5000/api/image/upload', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            set_imageSrc(data.data.url);
        } catch (error) {
            console.error('Error uploading image:', error);
        }
    };

    return (
        <ReactImagePickerEditor
            config={{
                borderRadius: '100%',
                language: 'en',
                width: '195px',
                height: '195px',
                objectFit: 'cover',
                compressInitial: null,
                aspectRatio: 1
            }}
            imageSrcProp={imageSrc}
            imageChanged={handleImageChange}
        />
    );
};

export default EditAvatar;

