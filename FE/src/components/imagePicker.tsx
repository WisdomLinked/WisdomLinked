import { useMemo, useState } from "react";
import ReactImagePickerEditor from "react-image-picker-editor";
import { useDispatch } from "react-redux";
import { showAlert } from "../actions/alertActions";


interface ImagePickerProps {
    key: any;
    initialImage: any;
    on_imageChange: any;
}

const ImagePicker = ({ key, initialImage, on_imageChange }: ImagePickerProps) => {
    return (

        <ReactImagePickerEditor
            key={key}
            config={{
                borderRadius: '100%',
                language: 'en',
                width: '195px',
                height: '195px',
                objectFit: 'cover',
                compressInitial: null,
                aspectRatio: 1
            }}
            imageSrcProp={initialImage}
            imageChanged={(newImageSrc: any) => {
                on_imageChange(newImageSrc);
            }}
        />
    )
}

export default ImagePicker;