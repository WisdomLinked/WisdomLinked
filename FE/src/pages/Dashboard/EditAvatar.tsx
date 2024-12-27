import React, { useState, useEffect } from "react";
import { profileImageUpload } from "../../api/api";
import ReactImagePickerEditor from 'react-image-picker-editor';
import 'react-image-picker-editor/dist/index.css'

const EditAvatar = ({ image, imageSrc, set_imageSrc, userId }: any) => {
    const [isUploading, setIsUploading] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true); // Track initial load

    const handleImageChange = async (newDataUri: any) => {
        // Skip upload if this is the initial load
        if (isInitialLoad) {
            setIsInitialLoad(false);
            return;
        }

        // Only proceed if a new image is selected
        if (!newDataUri || newDataUri === image || isUploading) return;

        setIsUploading(true);

        try {
            const fileExtension = newDataUri.split(';')[0].split('/')[1];
            const base64Response = await fetch(newDataUri);
            const blob = await base64Response.blob();
            const file = new File(
                [blob],
                `${userId}_${Date.now()}.${fileExtension}`,
                { type: blob.type }
            );

            const formData = new FormData();
            formData.append('image', file);

            const res = await profileImageUpload(formData);
            set_imageSrc(res.data.details[0].filename);
        } catch (error) {
            console.error('Error uploading image:', error);
        } finally {
            setIsUploading(false);
        }
    };

    useEffect(() => {
        // Set initial load flag when the component is mounted
        setIsInitialLoad(true);
    }, []);

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
            imageSrcProp={image}
            imageChanged={handleImageChange}
        />
    );
};

export default EditAvatar;

