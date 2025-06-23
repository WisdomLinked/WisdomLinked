import subhero_bg from '../assets/images/subhero_bg.jpg'

const Services = () => {
    return (
      <div className="w-full text-white">
        <div className="w-full h-[500px] relative">
            <img src={subhero_bg} className="w-full h-full object-cover object-center blur-sm" />
            <div className="absolute top-0 left-0 w-full h-full main_container flex justify-center items-center">
              <h1 className='w-full max-w-[1500px] mx-auto text-center text-white font-bold text-[32px] leading-[48px] lg:text-[72px] lg:leading-[94px] textShadow '>
                Uncommon Quality, Undeniable Value
              </h1>
            </div>
        </div>
        <div className="main_container text-lightgrey text-xl pt-14 flex flex-col lg:flex-row">
          <div className='w-full lg:w-[50%]'>
            <b className='text-2xl'>We provide advice regarding the following consulting-for-a-fee services through registered experts:</b>
            <ul className="list-disc my-3 pl-6">
              <li className='mt-2'>Study abroad (mainly in the western world) </li>
              <li className='mt-2'>Scientific research advice</li>
              <li className='mt-2'>Work in the west (including how to look for a job)</li>
              <li className='mt-2'>Others</li>
            </ul>
          </div>
          <div className='w-full lg:w-[50%] pl-0 lg:pl-4'>
            <p> &nbsp;We arrange one-to-one consulting conversation for a fee. Customers must register first through the website and provide necessary information for us to find matches of top experts. </p>
            <br/>
            <p> &nbsp;The registration is free of charge. Clients will decide whether to consult with an expert suggested by the services. This is mainly an appointment-based service.</p>
            <br/>
            <p> &nbsp;Once an available time slot is identified for both the expert and the client, an appointment will be made AFTER the client has paid online at the expert’s asking price.</p>
          </div>
        </div>
      </div>
    )
}

export default Services