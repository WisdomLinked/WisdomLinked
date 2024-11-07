import subhero_bg from '../assets/images/subhero_bg.jpg'

const Rules = () => {
    return (
      <div className="w-full text-white">
        <div className="w-full h-[500px] relative">
            <img src={subhero_bg} className="w-full h-full object-cover object-center blur-sm" />
            <div className="absolute top-0 left-0 w-full h-full main_container flex justify-center items-center">
              <h1 className='w-full max-w-[1500px] mx-auto text-center text-white font-bold text-[32px] leading-[48px] lg:text-[72px] lg:leading-[94px] textShadow '>
                We have Rules for Both <br/>
                  Experts and Clients
              </h1>
            </div>
        </div>
        <div className="main_container text-lightgrey text-xl pt-14">
          <b className='text-3xl'>Both experts and clients shall recognize the following rules regarding the services.</b>
          <ul className="list-disc mt-3 pl-6">
            <li className='mt-2'>The service is designed to be appointment based. Clients shall not expect to get instant, online services. An appointment is made after the client has paid at the asking price of an expert plus a tip. The payment is not refundable if the client does not show up at the appointment time; the payment is refundable if the expert fails to show up at the appointed time. </li>
            <li className='mt-2'>The client may file a complaint if the service is not provided as arranged such as tardiness of experts, if the system fails to function normally, or if the service received is too poor. The management will look into the complaint and make effort to get back to the client within five business days.</li>
            {/*<li className='mt-2'>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor</li>*/}
            {/*<li className='mt-2'>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor</li>*/}
            {/*<li className='mt-2'>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor</li>*/}
            {/*<li className='mt-2'>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor</li>*/}
          </ul>
        </div>
      </div>
    )
}

export default Rules