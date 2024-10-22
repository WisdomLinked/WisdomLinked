import React from "react";
import ReactImagePickerEditor from 'react-image-picker-editor';
import 'react-image-picker-editor/dist/index.css'

const EditAvatar = ({
    imageSrc,
    set_imageSrc
}:any) => {

    return (
        < ReactImagePickerEditor
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
            imageChanged={(newDataUri: any) => { set_imageSrc(newDataUri) }}
        />
    );
};

export default EditAvatar;
