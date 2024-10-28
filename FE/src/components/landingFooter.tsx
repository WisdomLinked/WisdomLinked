import { Link } from 'react-router-dom';
import logo from '../assets/images/logo.png';

const LandingFooter = () => {
    return (
        <div className="w-full">
            <div className="main_container flex flex-col py-[60px] lg:py-[100px] lg:flex-row lg:justify-between">
                <div className="w-full lg:w-[280px]">
                    <Link to='/' className={`w-fit flex items-center space-x-[2px] text-white font-black text-4xl`}>
                        <img src={logo} className="w-10 h-10"/>
                        <span>OE</span>
                    </Link>
                    <div className="text-white font-bold mt-10 text-[32px] leading-[48px] ">
                        Talk with experts
                    </div>
                    <div className="text-lightgrey mt-10 text-[16px] leading-[24px] ">
                        ©2023 TOE LTD. All rights reserved
                    </div>
                </div>
                <div className="w-full lg:w-[calc(100%-400px)] flex flex-wrap gap-[30px] lg:gap-[60px] md:flex-nowrap lg:flex-row justify-between mt-[30px] lg:mt-0">
                        <div className="w-full sm:w-auto flex flex-col space-y-3 lg:space-y-8">
                            <div className="font-bold text-white text-[20px] leading-[30px]">Product</div>
                            <div className="text-lightgrey text-[16px] leading-[24px]">Overview</div>
                            <div className="text-lightgrey text-[16px] leading-[24px]">Business Account</div>
                            <div className="text-lightgrey text-[16px] leading-[24px]">Credit Card</div>
                            <div className="text-lightgrey text-[16px] leading-[24px]">Financial Modelling</div>
                            <div className="text-lightgrey text-[16px] leading-[24px]">Spend Management</div>
                        </div>
                        <div className="w-full sm:w-auto flex flex-col space-y-3 lg:space-y-8">
                            <div className="font-bold text-white text-[20px] leading-[30px]">Resources</div>
                            <div className="text-lightgrey text-[16px] leading-[24px]">Help</div>
                            <div className="text-lightgrey text-[16px] leading-[24px]">Status</div>
                            <div className="text-lightgrey text-[16px] leading-[24px]">Privacy</div>
                            <div className="text-lightgrey text-[16px] leading-[24px]">Legal Agreement</div>
                            <div className="text-lightgrey text-[16px] leading-[24px]">Cookie Preferences</div>
                        </div>
                        <div className="w-full sm:w-auto flex flex-col space-y-3 lg:space-y-8">
                            <div className="font-bold text-white text-[20px] leading-[30px]">Company</div>
                            <div className="text-lightgrey text-[16px] leading-[24px]">About TOE</div>
                            <div className="text-lightgrey text-[16px] leading-[24px]">Careers</div>
                            <div className="text-lightgrey text-[16px] leading-[24px]">Contact</div>
                            <div className="text-lightgrey text-[16px] leading-[24px]">Press</div>
                            <div className="text-lightgrey text-[16px] leading-[24px]">Blog</div>
                        </div>
                        <div className="w-full sm:w-auto flex flex-col space-y-3 lg:space-y-8">
                            <div className="font-bold text-white text-[20px] leading-[30px]">Social media</div>
                            <div className="flex space-x-2 text-lightgrey">
                                <div className="w-10 h-10 rounded-full border border-lightgrey flex justify-center items-center">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M20.0025 3H3.9975C3.73355 3.00196 3.48097 3.10769 3.29433 3.29433C3.10769 3.48097 3.00196 3.73355 3 3.9975V20.0025C3.00196 20.2664 3.10769 20.519 3.29433 20.7057C3.48097 20.8923 3.73355 20.998 3.9975 21H12.615V14.04H10.275V11.3175H12.615V9.315C12.615 6.99 14.0325 5.7225 16.1175 5.7225C16.815 5.7225 17.5125 5.7225 18.21 5.8275V8.25H16.7775C15.645 8.25 15.4275 8.79 15.4275 9.5775V11.31H18.1275L17.775 14.0325H15.4275V21H20.0025C20.2664 20.998 20.519 20.8923 20.7057 20.7057C20.8923 20.519 20.998 20.2664 21 20.0025V3.9975C20.998 3.73355 20.8923 3.48097 20.7057 3.29433C20.519 3.10769 20.2664 3.00196 20.0025 3Z" fill="currentColor"/>
                                    </svg>
                                </div>
                                <div className="w-10 h-10 rounded-full border border-lightgrey flex justify-center items-center">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M16.8046 8.27572C17.4011 8.27572 17.8846 7.79219 17.8846 7.19572C17.8846 6.59925 17.4011 6.11572 16.8046 6.11572C16.2081 6.11572 15.7246 6.59925 15.7246 7.19572C15.7246 7.79219 16.2081 8.27572 16.8046 8.27572Z" fill="currentColor"/>
                                        <path d="M11.9999 7.37842C11.0859 7.37842 10.1924 7.64946 9.43235 8.15728C8.67235 8.6651 8.08 9.38688 7.73021 10.2313C7.38042 11.0758 7.2889 12.005 7.46722 12.9015C7.64554 13.798 8.0857 14.6215 8.73203 15.2678C9.37835 15.9141 10.2018 16.3543 11.0983 16.5326C11.9948 16.7109 12.924 16.6194 13.7685 16.2696C14.613 15.9198 15.3347 15.3275 15.8426 14.5675C16.3504 13.8075 16.6214 12.914 16.6214 11.9999C16.6214 10.7742 16.1345 9.59872 15.2678 8.73202C14.4011 7.86532 13.2256 7.37842 11.9999 7.37842ZM11.9999 14.9999C11.4066 14.9999 10.8266 14.824 10.3332 14.4943C9.83986 14.1647 9.45534 13.6961 9.22828 13.148C9.00122 12.5998 8.94181 11.9966 9.05756 11.4146C9.17332 10.8327 9.45904 10.2982 9.8786 9.8786C10.2982 9.45904 10.8327 9.17332 11.4146 9.05756C11.9966 8.94181 12.5998 9.00122 13.148 9.22828C13.6961 9.45534 14.1647 9.83986 14.4943 10.3332C14.824 10.8266 14.9999 11.4066 14.9999 11.9999C14.9999 12.7956 14.6838 13.5586 14.1212 14.1212C13.5586 14.6838 12.7956 14.9999 11.9999 14.9999Z" fill="currentColor"/>
                                        <path d="M12 4.6215C14.403 4.6215 14.688 4.6305 15.6368 4.674C16.2074 4.68077 16.7726 4.78555 17.3077 4.98375C17.696 5.13352 18.0486 5.36291 18.3428 5.65716C18.6371 5.95141 18.8665 6.304 19.0163 6.69225C19.2145 7.2274 19.3192 7.79262 19.326 8.36325C19.3695 9.312 19.3785 9.597 19.3785 12.0007C19.3785 14.4045 19.3695 14.688 19.326 15.6368C19.3192 16.2074 19.2145 16.7726 19.0163 17.3077C18.8665 17.696 18.6371 18.0486 18.3428 18.3428C18.0486 18.6371 17.696 18.8665 17.3077 19.0163C16.7726 19.2145 16.2074 19.3192 15.6368 19.326C14.688 19.3695 14.403 19.3785 12 19.3785C9.597 19.3785 9.312 19.3695 8.36325 19.326C7.79262 19.3192 7.2274 19.2145 6.69225 19.0163C6.304 18.8665 5.95141 18.6371 5.65716 18.3428C5.36291 18.0486 5.13352 17.696 4.98375 17.3077C4.78555 16.7726 4.68077 16.2074 4.674 15.6368C4.6305 14.688 4.6215 14.403 4.6215 12C4.6215 9.597 4.6305 9.312 4.674 8.36325C4.68077 7.79262 4.78555 7.2274 4.98375 6.69225C5.13352 6.304 5.36291 5.95141 5.65716 5.65716C5.95141 5.36291 6.304 5.13352 6.69225 4.98375C7.2274 4.78555 7.79262 4.68077 8.36325 4.674C9.312 4.6305 9.597 4.6215 12 4.6215ZM12 3C9.55575 3 9.249 3.0105 8.289 3.054C7.54258 3.06907 6.80412 3.21058 6.105 3.4725C5.50704 3.70372 4.96399 4.05733 4.51066 4.51066C4.05733 4.96399 3.70372 5.50704 3.4725 6.105C3.21049 6.80435 3.06899 7.54308 3.054 8.28975C3.0105 9.24975 3 9.555 3 12C3 14.445 3.0105 14.751 3.054 15.711C3.06907 16.4574 3.21058 17.1959 3.4725 17.895C3.70372 18.493 4.05733 19.036 4.51066 19.4893C4.96399 19.9427 5.50704 20.2963 6.105 20.5275C6.80435 20.7895 7.54308 20.931 8.28975 20.946C9.24975 20.9895 9.55575 21 12 21C14.4443 21 14.751 20.9895 15.711 20.946C16.4577 20.931 17.1964 20.7895 17.8958 20.5275C18.4937 20.2963 19.0368 19.9427 19.4901 19.4893C19.9434 19.036 20.297 18.493 20.5282 17.895C20.79 17.1956 20.9313 16.4569 20.946 15.7103C20.9895 14.7503 21 14.445 21 12C21 9.555 20.9895 9.249 20.946 8.289C20.9309 7.54258 20.7894 6.80412 20.5275 6.105C20.2963 5.50704 19.9427 4.96399 19.4893 4.51066C19.036 4.05733 18.493 3.70372 17.895 3.4725C17.1956 3.21075 16.4569 3.0695 15.7103 3.05475C14.7503 3.00975 14.445 3 12 3Z" fill="currentColor"/>
                                    </svg>
                                </div>
                                <div className="w-10 h-10 rounded-full border border-lightgrey flex justify-center items-center">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M8.94 18.705C10.2069 18.713 11.4627 18.4693 12.6346 17.9882C13.8066 17.507 14.8714 16.798 15.7672 15.9022C16.663 15.0064 17.3721 13.9416 17.8532 12.7696C18.3343 11.5977 18.578 10.3418 18.57 9.07499V8.63249C19.2267 8.15136 19.7951 7.56012 20.25 6.88499C19.6316 7.15544 18.9773 7.3348 18.3075 7.41749C19.0177 6.99432 19.5506 6.32824 19.8075 5.54249C19.1456 5.93957 18.4199 6.21871 17.6625 6.36749C17.1524 5.82401 16.4775 5.46378 15.7421 5.34253C15.0067 5.22128 14.2518 5.34576 13.5943 5.69673C12.9368 6.04769 12.4132 6.60557 12.1047 7.28405C11.7962 7.96252 11.7198 8.72376 11.8875 9.44999C10.542 9.38395 9.22553 9.03525 8.02377 8.42662C6.822 7.81798 5.7619 6.96305 4.9125 5.91749C4.48419 6.66087 4.35437 7.53923 4.54932 8.37473C4.74427 9.21023 5.24942 9.94043 5.9625 10.4175C5.43646 10.3972 4.92259 10.2533 4.4625 9.99749V10.035C4.45783 10.8119 4.71954 11.5669 5.20403 12.1742C5.68851 12.7815 6.3665 13.2044 7.125 13.3725C6.63573 13.5041 6.12322 13.5246 5.625 13.4325C5.84459 14.095 6.26376 14.6734 6.82503 15.0883C7.38631 15.5032 8.06219 15.7344 8.76 15.75C7.56691 16.7104 6.08407 17.239 4.5525 17.25C4.28396 17.2422 4.01606 17.2197 3.75 17.1825C5.30022 18.1702 7.1019 18.6909 8.94 18.6825" fill="currentColor"/>
                                    </svg>
                                </div>
                            </div>
                        </div>
                </div>
            </div>
        </div>
    )
}

export default LandingFooter;