import subhero_bg from '../assets/images/subhero_bg.jpg'

const AboutUS = () => {
    return (
      <div className="w-full text-white">
        <div className="w-full h-[500px] relative">
            <img src={subhero_bg} className="w-full h-full object-cover object-center blur-sm" />
            <div className="absolute top-0 left-0 w-full h-full main_container flex justify-center items-center">
              <h1 className='w-full max-w-[1500px] mx-auto text-center text-white font-bold text-[32px] leading-[48px] lg:text-[72px] lg:leading-[94px] textShadow '>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
              </h1>
            </div>
        </div>
        <div className="main_container text-lightgrey text-xl pt-14">
            <p> &nbsp;This is a global consulting service company backed by professors in top universities in the U.S. The business draws on the talents of elite professionals, mostly top notch professors, scientists, researchers and other successful professionals. These elite professionals all have their graduate degrees, mostly Ph.D. with decades of successful experiences. They are generally considered leaders in their respective field: admitting and advising graduate students, conducting cutting edge research in frontier areas, or advancing practices in industries, etc. </p>
            <br/>
            <p> &nbsp;Clients are people planning to go abroad for graduate studies, people who are looking for a job in the western world, and researchers who are seeking insightful advice with their research efforts. A 30-min conversation with an authoritative expert through this platform could save clients years or months effort or countless dollars that could otherwise be wasted in darkness.</p>
            <br/>
            <p> &nbsp;The talents sign on on a volunteer basis, provide their available time slots for consulting at an asking price of their choice. Clients need to prepay for the time slot at the asking price plus a client determined tip (zero or more) before an appointment is made.</p>
            <br/>
            <p> &nbsp;At the time of an appointment, the expert and client converse via provided platform through either video or audio, depending on their agreed choices. The conversation may be recorded for quality control. </p>
        </div>
      </div>
    )
}

export default AboutUS