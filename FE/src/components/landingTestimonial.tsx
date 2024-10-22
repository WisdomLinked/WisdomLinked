import React, { useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Navigation } from "swiper";
import avatar from '../assets/images/avatar.png'

const LandingTestimonial = () => {

    const toNext = () => {
        let prevButton:any = document.querySelector('#LandingTestimonial .swiper-button-next')
        prevButton?.click()
    }

    const toPrev = () => {
        let prevButton:any = document.querySelector('#LandingTestimonial .swiper-button-prev')
        prevButton?.click()
    }

    return (
        <div id='LandingTestimonial' className="w-full flex flex-col-reverse xl:flex-row py-[50px] xl:py-0 bg-black">
            <div className="main_container xl:px-0 w-full xl:w-[50%] flex flex-col justify-center relative">
                <Swiper
                    slidesPerView={"auto"}
                    breakpoints={{
                        0: {
                            spaceBetween: 20
                        },
                        640: {
                            spaceBetween: 40
                        }
                    }}
                    navigation={true}
                    pagination={{
                        clickable: true,
                    }}
                    modules={[Pagination, Navigation]}
                    className="w-full"
                >
                    <SwiperSlide className="!w-[calc(100%-30px)] sm:!w-[302px] rounded-[14px] bg-darkgrey relative text-grey p-8">
                        <svg width="27" height="22" className="absolute top-12 right-8" viewBox="0 0 27 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15.4 21.76V17.36C17.16 16.9333 18.52 16.16 19.48 15.04C20.44 13.8667 21.0267 12.4533 21.24 10.8H17V0.399995H26.2V7.2C26.2 11.0933 25.2933 14.32 23.48 16.88C21.6667 19.3867 18.9733 21.0133 15.4 21.76ZM0.600001 21.76V17.36C2.36 16.9333 3.72 16.16 4.68 15.04C5.64 13.8667 6.22667 12.4533 6.44 10.8H2.2V0.399995H11.4V7.2C11.4 11.0933 10.4933 14.32 8.68 16.88C6.86667 19.3867 4.17333 21.0133 0.600001 21.76Z" fill="currentColor"/>
                        </svg>
                        <img src={avatar} className="w-[53px] h-[53px] rounded-[8px]" />
                        <div className="mt-6 text-[24px] leading-[150%] text-white font-bold">
                            Eren Yaeger
                        </div>
                        <div className="mt-2 text-[16px] leading-[150%] text-lightgrey">
                            Lorem ipsum dolor sit amet consectetur. Risus morbi ultrices sit hac condimentum adipiscing. Risus auctor.
                        </div>
                        <div className="mt-8 flex items-center space-x-[5px] text-[20px] leading-[150%] font-bold text-white">
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M10.2976 2.63248L11.6176 5.27248C11.7976 5.63998 12.2776 5.99248 12.6826 6.05998L15.0751 6.45748C16.6051 6.71248 16.9651 7.82248 15.8626 8.91748L14.0026 10.7775C13.6876 11.0925 13.5151 11.7 13.6126 12.135L14.1451 14.4375C14.5651 16.26 13.5976 16.965 11.9851 16.0125L9.74255 14.685C9.33755 14.445 8.67005 14.445 8.25755 14.685L6.01505 16.0125C4.41005 16.965 3.43505 16.2525 3.85505 14.4375L4.38755 12.135C4.48505 11.7 4.31255 11.0925 3.99755 10.7775L2.13755 8.91748C1.04255 7.82248 1.39505 6.71248 2.92505 6.45748L5.31755 6.05998C5.71505 5.99248 6.19505 5.63998 6.37505 5.27248L7.69505 2.63248C8.41505 1.19998 9.58505 1.19998 10.2976 2.63248Z" fill="#DEA81D"/>
                            </svg>
                            <span>4.8</span>
                        </div>
                    </SwiperSlide>
                    <SwiperSlide className="!w-[calc(100%-30px)] sm:!w-[302px] rounded-[14px] bg-darkgrey relative text-grey p-8">
                        <svg width="27" height="22" className="absolute top-12 right-8" viewBox="0 0 27 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15.4 21.76V17.36C17.16 16.9333 18.52 16.16 19.48 15.04C20.44 13.8667 21.0267 12.4533 21.24 10.8H17V0.399995H26.2V7.2C26.2 11.0933 25.2933 14.32 23.48 16.88C21.6667 19.3867 18.9733 21.0133 15.4 21.76ZM0.600001 21.76V17.36C2.36 16.9333 3.72 16.16 4.68 15.04C5.64 13.8667 6.22667 12.4533 6.44 10.8H2.2V0.399995H11.4V7.2C11.4 11.0933 10.4933 14.32 8.68 16.88C6.86667 19.3867 4.17333 21.0133 0.600001 21.76Z" fill="currentColor"/>
                        </svg>
                        <img src={avatar} className="w-[53px] h-[53px] rounded-[8px]" />
                        <div className="mt-6 text-[24px] leading-[150%] text-white font-bold">
                            Eren Yaeger
                        </div>
                        <div className="mt-2 text-[16px] leading-[150%] text-lightgrey">
                            Lorem ipsum dolor sit amet consectetur. Risus morbi ultrices sit hac condimentum adipiscing. Risus auctor.
                        </div>
                        <div className="mt-8 flex items-center space-x-[5px] text-[20px] leading-[150%] font-bold text-white">
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M10.2976 2.63248L11.6176 5.27248C11.7976 5.63998 12.2776 5.99248 12.6826 6.05998L15.0751 6.45748C16.6051 6.71248 16.9651 7.82248 15.8626 8.91748L14.0026 10.7775C13.6876 11.0925 13.5151 11.7 13.6126 12.135L14.1451 14.4375C14.5651 16.26 13.5976 16.965 11.9851 16.0125L9.74255 14.685C9.33755 14.445 8.67005 14.445 8.25755 14.685L6.01505 16.0125C4.41005 16.965 3.43505 16.2525 3.85505 14.4375L4.38755 12.135C4.48505 11.7 4.31255 11.0925 3.99755 10.7775L2.13755 8.91748C1.04255 7.82248 1.39505 6.71248 2.92505 6.45748L5.31755 6.05998C5.71505 5.99248 6.19505 5.63998 6.37505 5.27248L7.69505 2.63248C8.41505 1.19998 9.58505 1.19998 10.2976 2.63248Z" fill="#DEA81D"/>
                            </svg>
                            <span>4.8</span>
                        </div>
                    </SwiperSlide>
                    <SwiperSlide className="!w-[calc(100%-30px)] sm:!w-[302px] rounded-[14px] bg-darkgrey relative text-grey p-8">
                        <svg width="27" height="22" className="absolute top-12 right-8" viewBox="0 0 27 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15.4 21.76V17.36C17.16 16.9333 18.52 16.16 19.48 15.04C20.44 13.8667 21.0267 12.4533 21.24 10.8H17V0.399995H26.2V7.2C26.2 11.0933 25.2933 14.32 23.48 16.88C21.6667 19.3867 18.9733 21.0133 15.4 21.76ZM0.600001 21.76V17.36C2.36 16.9333 3.72 16.16 4.68 15.04C5.64 13.8667 6.22667 12.4533 6.44 10.8H2.2V0.399995H11.4V7.2C11.4 11.0933 10.4933 14.32 8.68 16.88C6.86667 19.3867 4.17333 21.0133 0.600001 21.76Z" fill="currentColor"/>
                        </svg>
                        <img src={avatar} className="w-[53px] h-[53px] rounded-[8px]" />
                        <div className="mt-6 text-[24px] leading-[150%] text-white font-bold">
                            Eren Yaeger
                        </div>
                        <div className="mt-2 text-[16px] leading-[150%] text-lightgrey">
                            Lorem ipsum dolor sit amet consectetur. Risus morbi ultrices sit hac condimentum adipiscing. Risus auctor.
                        </div>
                        <div className="mt-8 flex items-center space-x-[5px] text-[20px] leading-[150%] font-bold text-white">
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M10.2976 2.63248L11.6176 5.27248C11.7976 5.63998 12.2776 5.99248 12.6826 6.05998L15.0751 6.45748C16.6051 6.71248 16.9651 7.82248 15.8626 8.91748L14.0026 10.7775C13.6876 11.0925 13.5151 11.7 13.6126 12.135L14.1451 14.4375C14.5651 16.26 13.5976 16.965 11.9851 16.0125L9.74255 14.685C9.33755 14.445 8.67005 14.445 8.25755 14.685L6.01505 16.0125C4.41005 16.965 3.43505 16.2525 3.85505 14.4375L4.38755 12.135C4.48505 11.7 4.31255 11.0925 3.99755 10.7775L2.13755 8.91748C1.04255 7.82248 1.39505 6.71248 2.92505 6.45748L5.31755 6.05998C5.71505 5.99248 6.19505 5.63998 6.37505 5.27248L7.69505 2.63248C8.41505 1.19998 9.58505 1.19998 10.2976 2.63248Z" fill="#DEA81D"/>
                            </svg>
                            <span>4.8</span>
                        </div>
                    </SwiperSlide>
                    <SwiperSlide className="!w-[calc(100%-30px)] sm:!w-[302px] rounded-[14px] bg-darkgrey relative text-grey p-8">
                        <svg width="27" height="22" className="absolute top-12 right-8" viewBox="0 0 27 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15.4 21.76V17.36C17.16 16.9333 18.52 16.16 19.48 15.04C20.44 13.8667 21.0267 12.4533 21.24 10.8H17V0.399995H26.2V7.2C26.2 11.0933 25.2933 14.32 23.48 16.88C21.6667 19.3867 18.9733 21.0133 15.4 21.76ZM0.600001 21.76V17.36C2.36 16.9333 3.72 16.16 4.68 15.04C5.64 13.8667 6.22667 12.4533 6.44 10.8H2.2V0.399995H11.4V7.2C11.4 11.0933 10.4933 14.32 8.68 16.88C6.86667 19.3867 4.17333 21.0133 0.600001 21.76Z" fill="currentColor"/>
                        </svg>
                        <img src={avatar} className="w-[53px] h-[53px] rounded-[8px]" />
                        <div className="mt-6 text-[24px] leading-[150%] text-white font-bold">
                            Eren Yaeger
                        </div>
                        <div className="mt-2 text-[16px] leading-[150%] text-lightgrey">
                            Lorem ipsum dolor sit amet consectetur. Risus morbi ultrices sit hac condimentum adipiscing. Risus auctor.
                        </div>
                        <div className="mt-8 flex items-center space-x-[5px] text-[20px] leading-[150%] font-bold text-white">
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M10.2976 2.63248L11.6176 5.27248C11.7976 5.63998 12.2776 5.99248 12.6826 6.05998L15.0751 6.45748C16.6051 6.71248 16.9651 7.82248 15.8626 8.91748L14.0026 10.7775C13.6876 11.0925 13.5151 11.7 13.6126 12.135L14.1451 14.4375C14.5651 16.26 13.5976 16.965 11.9851 16.0125L9.74255 14.685C9.33755 14.445 8.67005 14.445 8.25755 14.685L6.01505 16.0125C4.41005 16.965 3.43505 16.2525 3.85505 14.4375L4.38755 12.135C4.48505 11.7 4.31255 11.0925 3.99755 10.7775L2.13755 8.91748C1.04255 7.82248 1.39505 6.71248 2.92505 6.45748L5.31755 6.05998C5.71505 5.99248 6.19505 5.63998 6.37505 5.27248L7.69505 2.63248C8.41505 1.19998 9.58505 1.19998 10.2976 2.63248Z" fill="#DEA81D"/>
                            </svg>
                            <span>4.8</span>
                        </div>
                    </SwiperSlide>
                </Swiper>
                <button onClick={toPrev} className="hidden sm:flex absolute top-[50%] left-10 -translate-y-[50%] rotate-180 w-[45px] h-[45px] rounded-full bg-midgrey justify-center items-center z-[100]">
                    <svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11.0223 4.72607L15.5186 9.22237L11.0223 13.7187" stroke="white" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M2.92615 9.22217H15.3928" stroke="white" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </button>
                <button onClick={toNext} className="hidden sm:flex absolute top-[50%] right-[30px] xl:-right-[30px] -translate-y-[50%] w-[45px] h-[45px] rounded-full bg-midgrey justify-center items-center z-[100]">
                    <svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11.0223 4.72607L15.5186 9.22237L11.0223 13.7187" stroke="white" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M2.92615 9.22217H15.3928" stroke="white" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </button>
            </div>
            <div className="w-full xl:w-[50%] main_container pt-[40px] xl:pt-[100px] pb-[66px] xl:pb-[89px]">
                <div className="w-full xl:max-w-[600px]">
                    <div className="w-fit px-[25px] py-[5px] rounded-[80px] bg-darkgrey text-white text-[12px] leading-[15px] xl:text-[14px] xl:leading-[21px]">Testimonials from user 🤩</div>
                    <div className="font-bold text-white mt-3 text-[32px] leading-[48px] xl:text-[56px] xl:leading-[78px]">What our user say about us</div>
                    <div className="text-lightgrey mt-3 text-[14px] xl:text-[18px] leading-[27px">You will get many benefits from our features. Finding a parking space becomes easier</div>
                    <button
                        className="border border-white mt-[40px] xl:mt-[24px] rounded-[14px] text-[16px] leading-[24px] px-[27.5px] py-[11px] xl:px-[42px] xl:py-[15px] text-white"
                        onClick={() => {}}
                    >
                        Learn more
                    </button>
                </div>
            </div>
        </div>
    )
}

export default LandingTestimonial;