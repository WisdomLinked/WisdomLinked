import React from 'react';

function LoadingPlaceHolder(props:any) {

    const loaderStyles:any = {
        backgroundColor: '#141414',
        width: '100%',
        overflow: 'hidden',
        position: props.container ? 'absolute' : 'relative',
        ...props.extraStyles
    };

    const loaderSwipeStyles:any = {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        background: 'linear-gradient(to right, #141414 10%, #1f1f1f 50%, #141414 90%)',
        animation: 'loaderSwipeAnim 1s cubic-bezier(0.4, 0.0, 0.2, 1) infinite',
        height: '100%'
    }

    return (
        <div className={props.className} style={loaderStyles}>
            <div style={loaderSwipeStyles}></div>
        </div>
    );
}

export default LoadingPlaceHolder;
