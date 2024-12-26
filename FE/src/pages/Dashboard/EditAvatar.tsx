import React from "react";
import {profileImageUpload} from "../../api/api";
import ReactImagePickerEditor from 'react-image-picker-editor';
import 'react-image-picker-editor/dist/index.css'

const EditAvatar = ({image, imageSrc, set_imageSrc,userId }: any) => {
    const handleImageChange = async (newDataUri: any) => {
        // Extract file extension from the data URI
        const fileExtension = newDataUri.split(';')[0].split('/')[1];
        console.log(newDataUri.split(';')[0].split(':')[1]);

        // Convert base64 to files
        const base64Response = await fetch(newDataUri);
        const blob = await base64Response.blob();
        const file = new File([blob], `${userId}_${Date.now()}.${fileExtension}`, { type: blob.type });

        // Create form data
        const formData = new FormData();
        formData.append('image', file);
        //console.log("formData", formData);

        try {
            const res = await profileImageUpload(formData)
            console.log("image data",res)
            set_imageSrc(res.data.details[0].filename);
        } catch (error) {
            set_imageSrc(imageSrc)
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
            imageSrcProp={image}
            imageChanged={(newUri:any)=>{handleImageChange(newUri)}}
        />
    );
};

export default EditAvatar;

