import React, { useEffect, useState } from 'react';
import $ from 'jquery';

const FileBrowser = ({ file, set_file , set_fileError}: any) => {
    const [active, set_active] = useState(false)
    const [text, set_text] = useState('Drag & Drop')

    const dragOverHandler = (e: any) => {
        e.preventDefault();
        set_active(true)
        if (file)
            set_text('Release to Change File');
        else
            set_text('Release to Select File');
    }

    const dragLeaveHandler = (e: any) => {
        set_active(false)
        set_text('Drag & Drop');
        if (file)
            set_text('Drag & Drop to Change File');
        else
            set_text('Drag & Drop to Select File');
    }

    const dropHandler = (e: any) => {
        e.preventDefault();
        set_text('Drag & Drop');
        fileHandler(e.dataTransfer.files[0]);
    }

    const fChangeHandler = (e: any) => {
        fileHandler(e.target.files[0]);
    }

    const fileHandler = (file_: any) => {
        if (file_) {
            validateDoc(file_);
        } else {
            set_file(false);
            set_active(false)
        }
    }

    const clickInput = () => {
        $('#contactUsFileInput').val('');
        if (!file)
            $('#contactUsFileInput').click();
        else {
            set_file(false);
            set_active(false)
            $('#contactUsFileInput').click();
        }
    }

    const deleteFile = () => {
        set_active(false)
        $('#contactUsFileInput').val('');
        set_file(false);
        set_text('Drag & Drop');
        set_fileError('')
    }

    const validateDoc = (file: any) => {
        let fileType = file.type; //getting selected file type
        let validExtensions = ["application/pdf", "application/docx", "application/doc"]; //adding some valid image extensions in array
        let fileSize = file.size; //getting file size in bytes
        set_file(file);
        set_active(false)
        if (validExtensions.includes(fileType)) { //if user selected file is a DOC, PDF, or DOCX file
            set_text('Drag & Drop');
            if (fileSize > 2097152) { //checking if the file size is up to 2MB (2,097,152,000 bytes)
                set_fileError('File size is too large. Please choose a file up to 2MB.');
            } else {
                set_fileError('')
            }
        } else {
            set_fileError('Please select a DOC, DOCX or PDF file.');
        }
    };

    return (
        <div>
            <div 
                className={`w-full h-auto text-lg text-white rounded-[15px] border ${active ? 'border-dashed' : ''} mt-0.5 p-3 flex flex-col items-center justify-center`} 
                onDragOver={dragOverHandler} 
                onDragLeave={dragLeaveHandler} 
                onDrop={dropHandler}
            >
                <div className='text-center'>{text}</div>
                <div className='mt-1'>OR</div>
                <button  
                    className='bg-green rounded-lg px-4 py-1 mt-1'
                    onClick={clickInput}
                > 
                    {file ? 'Change File' : 'Select File'}
                </button>
                  
                <p className={`mt-3 text-base text-green ${file ? 'flex space-x-4 items-center' : 'hidden'}`}>
                    <span>Selected file : {file?.name}</span>
                    <button onClick={deleteFile}>
                        <svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24px" height="24px"><path d="M 10 2 L 9 3 L 3 3 L 3 5 L 4.109375 5 L 5.8925781 20.255859 L 5.8925781 20.263672 C 6.023602 21.250335 6.8803207 22 7.875 22 L 16.123047 22 C 17.117726 22 17.974445 21.250322 18.105469 20.263672 L 18.107422 20.255859 L 19.890625 5 L 21 5 L 21 3 L 15 3 L 14 2 L 10 2 z M 6.125 5 L 17.875 5 L 16.123047 20 L 7.875 20 L 6.125 5 z" /></svg>
                    </button>
                </p>
                <input id={"contactUsFileInput"} type="file" hidden onChange={fChangeHandler} name="file" />
            </div>
        </div>
    );
}

export default FileBrowser;
