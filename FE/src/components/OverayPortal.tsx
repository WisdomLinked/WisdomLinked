import React from 'react'
import { createPortal } from 'react-dom'

const OverlayPortal = ({children, closeModal, zIndex = 100000}: any) => {
    return (
        createPortal(
            <div className='fixed inset-0 animation_fadeIn' style={{ zIndex }}>
                {/* Behind the menu. A full-size sibling painted on top swallows the
                    click that opened the menu and closes it immediately. */}
                <div className='absolute inset-0 z-0' onClick={closeModal}/>
                {children}
            </div>,
            document.getElementsByTagName('body')[0]
        )
    )
}

export default OverlayPortal
