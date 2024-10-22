import React from "react";
import dashboard_img1 from '../assets/images/dashboard_img1.png'
import dashboard_img2 from '../assets/images/dashboard_img2.png'
import { Link } from "react-router-dom";

const LandingSolution = () => {
    return (
        <div className="flex bg-black">
            <div className="main_container pt-[40px] lg:pt-[100px] pb-[81px] lg:pb-[101px]">
                <div className="w-full flex justify-center">
                    <div className="w-fit px-[25px] py-[10px] bg-darkgrey rounded-[80px] text-[12px] leading-[15px] text-white">Our best solution for you ✨</div>
                </div>
                <div className="text-center text-white font-bold mt-3 text-[32px] leading-[48px] lg:text-[56px] lg:leading-[78px]">
                    We have solutions that work for you.
                </div>
                <div className="w-full mt-10 lg:mt-16 flex flex-col lg:flex-row rounded-[30px] bg-white overflow-clip">
                    <div className="w-full lg:w-[40%] p-5 lg:p-10 text-darkgrey">
                        <div className="font-bold text-[24px] leading-[36px] lg:text-[40px] lg:leading-[60px]">TOE for Customer</div>
                        <div className="text-midgrey mt-6 text-[14px] lg:text-[18px] leading-[27px]">
                            <b>Example topics for consulting:</b>
                            <ul className="list-disc pl-6">
                                <li>Graduate studies in the U.S.: how to apply and what universities to apply for</li>
                                <li>Assess my scientific research on a specific topic: what shall I focus my efforts on and how?</li>
                                <li>Look for a job after graduated: how and what to pay attention to?</li>
                            </ul>
                        </div>
                        <Link
                            to='/customerregister'
                            className="block w-fit border border-black mt-[47px] rounded-[14px] text-[16px] leading-[24px] px-[27.5px] py-[11px] lg:px-[42px] lg:py-[15px]"
                        >
                            Register
                        </Link>
                    </div>
                    <div className="w-full lg:w-[60%] relative">
                        <div className="lg:absolute lg:left-0 lg:bottom-0 w-full h-full">
                            <img src={dashboard_img2} className="lg:object-cover lg:object-left-top w-full h-full"/>
                        </div>
                    </div>
                </div>
                <div className="w-full mt-6 flex flex-col lg:flex-row rounded-[30px] bg-darkgrey overflow-clip">
                    <div className="w-full lg:w-[40%] p-5 pb-[60px] lg:p-10 text-white">
                        <div className="text-white font-bold text-[24px] leading-[36px] lg:text-[40px] lg:leading-[60px]">TOE for Expert</div>
                        <div className="text-lightgrey mt-6 text-[14px] lg:text-[18px] leading-[27px]">
                            <b>Benefits for experts:</b>
                            <ul className="list-disc pl-6">
                                <li>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor</li>
                                <li>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor</li>
                                <li>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor</li>
                            </ul>
                        </div>
                        <Link
                            to='/expertregister'
                            className="block w-fit border border-white mt-[47px] rounded-[14px] text-[16px] leading-[24px] px-[27.5px] py-[11px] lg:px-[42px] lg:py-[15px]"
                        >
                            Register
                        </Link>
                    </div>
                    <div className="w-full lg:w-[60%] relative">
                        <div className="lg:absolute lg:left-0 lg:bottom-0 w-full h-full">
                            <img src={dashboard_img1} className="object-cover object-left-top w-full h-full"/>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LandingSolution;