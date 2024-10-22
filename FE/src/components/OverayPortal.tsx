import React from 'react'
import { createPortal } from 'react-dom'

const OverlayPortal = ({children, closeModal}: any) => {
    return (
        createPortal(
            <div className='fixed top-0 left-0 w-full h-full z-[100000] animation_fadeIn'>
                <div className='w-full h-full' onClick={closeModal}/>
                {children}
            </div>,
            document.getElementsByTagName('body')[0]
        )
    )
}

export default OverlayPortal
