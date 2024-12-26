// import React from "react";
// import ReactImagePickerEditor from 'react-image-picker-editor';
// import 'react-image-picker-editor/dist/index.css'
//
// const EditAvatar = ({
//     imageSrc,
//     set_imageSrc
// }:any) => {
//
//     return (
//         < ReactImagePickerEditor
//             config={{
//                 borderRadius: '100%',
//                 language: 'en',
//                 width: '195px',
//                 height: '195px',
//                 objectFit: 'cover',
//                 compressInitial: null,
//                 aspectRatio: 1
//             }}
//             imageSrcProp={imageSrc}
//             imageChanged={(newDataUri: any) => { set_imageSrc(newDataUri) }}
//         />
//     );
// };
//
// export default EditAvatar;

import React from "react";
import ReactImagePickerEditor from 'react-image-picker-editor';
import 'react-image-picker-editor/dist/index.css'

const EditAvatar = ({ imageSrc, set_imageSrc, userId }: any) => {
    const handleImageChange = async (newDataUri: any) => {
        // Convert base64 to file
        const base64Response = await fetch(newDataUri);
        const blob = await base64Response.blob();
        const file = new File([blob], `${userId}.png`, { type: 'image/png' });

        // Create form data
        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await fetch('http://localhost:5000/api/image/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            set_imageSrc(data.data.url); // Assuming the API returns the image URL
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

