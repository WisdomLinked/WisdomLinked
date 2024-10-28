import hero_bg from '../assets/images/hero_bg.jpg'

const LandingHero = () => {
    return (
        <div className="w-full flex flex-col lg:flex-row relative">
            <div className="w-full lg:w-[55%] lg:min-w-[800px] main_container lg:pr-0 py-9 lg:py-[56px] z-10">
                <div className="w-fit flex items-center space-x-[10px] bg-darkgrey rounded-[80px] p-[5px] pr-[25px]">
                    <div className="px-[9.5px] py-[6px] rounded-[60px] bg-green text-white text-[10px] leading-[13px] lg:text-[12px] lg:leading-[15px]">News!</div>
                    <div className="text-white text-[12px] leading-[15px] lg:text-[14px] lg:leading-[21px]">Update New features for active users ✨</div>
                </div>
                <h1 className="mt-3 text-white font-bold text-[32px] leading-[48px] lg:text-[72px] lg:leading-[94px] textShadow">
                    Thoughts of Experts (TOE) Consulting
                </h1>
                <div className="text-[14px] leading-[21px] lg:text-[18px] lg:leading-[27px] mt-6 lg:mt-8 text-lightgrey textShadow">
                    Talk directly with experts about topics in study, research, work and life across countries. Experts are top university professors, scientists, researchers, senior engineers, and mainstream corporative managers, mostly with a Ph.D. degree. They have decades of  experiences advising graduate students, conducting top quality scientific research, supervising professionals, and successfully settling their lives in a new world. They are generally considered elites of the elite.
                </div>
                <div className="flex space-x-4 mt-10">
                    <button 
                        className="bg-green rounded-[14px] flex items-center justify-center px-6 py-[15px] text-[16px] leading-[24px] text-white"
                        onClick={() => {}}
                    >
                        <span>Get started</span>
                        <span className="hidden lg:block">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M14.4299 5.92993L20.4999 11.9999L14.4299 18.0699" stroke="white" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M3.5 12H20.33" stroke="white" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </span>
                    </button>
                    <button 
                        className="border border-lightgrey rounded-[14px] px-6 py-[15px] text-[16px] leading-[24px] text-white"
                        onClick={() => {}}
                    >
                        Learn more
                    </button>
                </div>
                <div className="mt-[60px] lg:mt-[74px] flex space-x-9 lg:space-x-15 lg:space-x-[100px]">
                    <div className="flex flex-col">
                        <div className="font-bold text-white text-[24px] leading-[36px] lg:text-[48px] lg:leading-[72px]">
                            <span>290k</span><span className="text-green">+</span>
                        </div>
                        <div className="text-[14px] leading-[21px] mt-[5px] lg:text-[18px] lg:leading-[27px] text-lightgrey">Top experts</div>
                    </div>
                    <div className="flex flex-col">
                        <div className="font-bold text-white text-[24px] leading-[36px] lg:text-[48px] lg:leading-[72px]">
                            <span>110k</span><span className="text-green">+</span>
                        </div>
                        <div className="text-[14px] leading-[21px] mt-[5px] lg:text-[18px] lg:leading-[27px] text-lightgrey">Active users</div>
                    </div>
                    <div className="flex flex-col">
                        <div className="font-bold text-white text-[24px] leading-[36px] lg:text-[48px] lg:leading-[72px]">
                            <span>900k</span><span className="text-green">+</span>
                        </div>
                        <div className="text-[14px] leading-[21px] mt-[5px] lg:text-[18px] lg:leading-[27px] text-lightgrey">Feedbacks</div>
                    </div>
                </div>
            </div>
            <div className="w-full lg:w-[45%] h-[500px] lg:h-auto relative z-0">
                <div className="w-full lg:w-[max(900px,120%)] h-full absolute top-0 right-0 z-0">
                    <img src={hero_bg} className="w-full h-full object-cover object-center"/>
                </div>
            </div>
        </div>
    )
}

export default LandingHero;