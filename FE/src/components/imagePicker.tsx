import { useMemo, useState } from "react";
import ReactImagePickerEditor from "react-image-picker-editor";
import { useDispatch } from "react-redux";
import { showAlert } from "../actions/alertActions";
import ShowFieldError from "./ShowFieldError";
import { MAX_IMAGE_SIZE_IN_MB } from "../utils/constants";


interface ImagePickerProps {
    key: any;
    initialImage: any;
    on_imageChange: any;
    showError?: boolean;
}

const ImagePicker = ({ key, initialImage, on_imageChange, showError }: ImagePickerProps) => {
    return (
        <>
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
            <ShowFieldError
                show={showError}
                label={`Image size cannot be greater than ${MAX_IMAGE_SIZE_IN_MB}MB`}
            />
        </>
    )
}

export default ImagePicker;