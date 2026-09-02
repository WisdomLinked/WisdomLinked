import { useMemo, useState } from "react";
import ReactImagePickerEditor from "react-image-picker-editor";
import { useDispatch } from "react-redux";
import { showErrorAlert, showSuccessAlert, showWarningAlert } from '../actions/alertActions';
import ShowFieldError from "./ShowFieldError";
import { MAX_IMAGE_SIZE_IN_MB } from "../utils/constants";


interface ImagePickerProps {
    key: any;
    initialImage: any;
    on_imageChange: any;
    validator?: any;
}

const ImagePicker = ({  initialImage, on_imageChange, validator }: ImagePickerProps) => {

    const [showError, set_showError] = useState(false);

    return (
        <>
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
                imageSrcProp={initialImage}
                imageChanged={(newImageSrc: any) => {
                    on_imageChange(newImageSrc);
                    set_showError(!validator(newImageSrc))
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