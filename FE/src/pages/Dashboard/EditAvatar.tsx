import React,{useState} from "react";
import ReactImagePickerEditor from 'react-image-picker-editor';
import 'react-image-picker-editor/dist/index.css'

const EditAvatar = ({ imageSrc, set_imageSrc }: any) => {
    const handleImageChange =  (newDataUri: any) => {
        console.log("image setting", newDataUri);
        set_imageSrc(newDataUri);
    }

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

export default React.memo(EditAvatar);
