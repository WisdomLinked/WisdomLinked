import React from "react";
import { Link } from "react-router-dom";

const Header = () => {

    const [opened, set_opened] = React.useState(false)

    React.useEffect(() => {
        if (opened) {
            document.getElementsByTagName('body')[0].classList.add('overflow-hidden')
        } else {
            document.getElementsByTagName('body')[0].classList.remove('overflow-hidden')
        }
    }, [opened])

    return (
        <div className={`sticky top-0 left-0 main_container py-[20px] text-white bg-black bg-opacity-50 backdrop-blur-sm z-20`}>
            {/* MOBILE VIEW */}
            <div className="w-full flex lg:hidden justify-between items-center">
                <Link to='/' className={`w-fit flex items-center space-x-[8px] font-black text-2xl`}>
                    <div className="h-11 max-w-[200px] rounded-2xl bg-white flex items-center justify-center overflow-hidden px-2">
                        <img src="/logos/main_gold_blue.svg" className="h-9 w-auto max-w-[160px] object-contain object-left" alt="" />
                    </div>
                    <span className="tracking-[0.08em] uppercase">WisdomLinked</span>
                </Link>
                <button 
                    className="w-6 h-6 flex justify-center items-center"
                    onClick={() => set_opened(!opened)}
                >
                    {
                        opened ? 
                        <svg width="20" height="20" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2.0336 16.2126L8.2336 10.0126L2.0336 3.81263C1.7961 3.57903 1.66172 3.25951 1.66016 2.92669C1.65938 2.59309 1.79141 2.27357 2.02734 2.03763C2.26328 1.80247 2.5828 1.67045 2.9164 1.67201C3.25 1.67357 3.56874 1.80795 3.80234 2.04623L9.99994 8.24623L16.1999 2.04623C16.4335 1.80795 16.7523 1.67357 17.0859 1.67201C17.4187 1.67045 17.739 1.80248 17.9749 2.03763C18.2109 2.27357 18.3429 2.59309 18.3413 2.92669C18.3406 3.25951 18.2062 3.57903 17.9687 3.81263L11.7663 10.0126L17.9663 16.2126C18.2038 16.4462 18.3382 16.7658 18.3397 17.0986C18.3405 17.4322 18.2085 17.7517 17.9725 17.9876C17.7366 18.2228 17.4171 18.3548 17.0835 18.3533C16.7499 18.3517 16.4311 18.2173 16.1975 17.979L9.99994 11.779L3.79994 17.979C3.31088 18.4611 2.52494 18.4579 2.039 17.9736C1.55384 17.4884 1.54994 16.7025 2.03119 16.2126L2.0336 16.2126Z" fill="currentColor"></path>
                        </svg> :
                        <svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 6.01263H20M4 12.0126H20M4 18.0126H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                        </svg>
                    }
                </button>
            </div>
            {/* MOBILE NAVIGATE MODAL */}
            <div className={`z-20 lg:hidden fixed top-[80px] left-0 w-full h-[calc(100vh-80px)] bg-black overflow-y-auto ${opened ? '' : 'hidden'}`}>
                <div className="px-5 py-4 text-base text-white space-y-3">
                    <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row justify-between">
                        <Link to='/customerregister' className="flex justify-center sm:w-[calc(50%-6px)] py-3 rounded-xl bg-darkgrey">Customer Register</Link>
                        <Link to='/expertregister' className="flex justify-center sm:w-[calc(50%-6px)] py-3 rounded-xl bg-darkgrey">Expert Register</Link>
                    </div>
                    <Link to='/login' className="flex justify-center py-3 rounded-xl bg-green text-white">Sign In</Link>
                    <Link to="/aboutus" className="bg-darkgrey flex justify-center py-3 rounded-xl" onClick={() => set_opened(false)}>
                        <span>About US</span>
                    </Link>
                    <Link to="/services" className="bg-darkgrey flex justify-center py-3 rounded-xl" onClick={() => set_opened(false)}>
                        <span>Services</span>
                    </Link>
                    <Link to="/rules" className="bg-darkgrey flex justify-center py-3 rounded-xl" onClick={() => set_opened(false)}>
                        <span>Rules</span>
                    </Link>
                    <Link to="/contactus" className="bg-darkgrey flex justify-center py-3 rounded-xl" onClick={() => set_opened(false)}>
                        <span>Contact US</span>
                    </Link>
                </div>
            </div>
            {/* DESKTOP VIEW */}
            <div className="w-full hidden lg:flex justify-between items-center text-[16px] leading-[24px]">
                    <Link to='/' className={`w-fit flex items-center space-x-[10px] font-black text-2xl`}>
                        <div className="h-12 max-w-[220px] rounded-2xl bg-white flex items-center justify-center overflow-hidden px-2">
                            <img src="/logos/main_gold_blue.svg" className="h-10 w-auto max-w-[180px] object-contain object-left" alt="" />
                        </div>
                        <span className="tracking-[0.12em] uppercase text-white">WisdomLinked</span>
                    </Link>
                    {/* <button 
                        className="flex space-x-[10px] items-center ml-14 xl:ml-[72px]"
                        onClick={() => {}}
                    >
                        <span>Solution</span>
                        <div 
                            className="w-4 h-4 flex items-center justify-center"
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M13.28 5.9668L8.9333 10.3135C8.41997 10.8268 7.57997 10.8268 7.06664 10.3135L2.71997 5.9668" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                    </button> */}
                <div className="flex space-x-10 items-center">
                    <Link to='/aboutus'>About US</Link>
                    <Link to='/services'>Services</Link>
                    <Link to='/rules'>Rules</Link>
                    <Link to='/contactus'>Contact US</Link>
                </div>
                <div className="flex items-center space-x-10">
                    <div className="h-[48px] py-3 relative hoverBox cursor-pointer">
                        Create Account
                        <div className="absolute w-full top-10 left-0 bg-darkgrey p-3 hidden rounded-sm">
                            <Link to='/customerregister' className="block text-center">Customer</Link>
                            <Link to='/expertregister' className="block text-center mt-2">Expert</Link>
                        </div>
                    </div>
                    <Link to='/login' className="px-[39px] py-3 rounded-[14px] bg-green text-white">Sign In</Link>
                </div>
            </div>
        </div>
    )
}

export default Header;