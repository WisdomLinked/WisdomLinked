import subhero_bg from '../assets/images/subhero_bg.jpg'
import { rulesPage } from '../content/publicPages'

const Rules = () => {
    return (
      <div className="w-full text-white">
        <div className="w-full h-[500px] relative">
            <img src={subhero_bg} className="w-full h-full object-cover object-center blur-sm" />
            <div className="absolute top-0 left-0 w-full h-full main_container flex justify-center items-center">
              <h1 className='w-full max-w-[1500px] mx-auto text-center text-white font-bold text-[32px] leading-[48px] lg:text-[72px] lg:leading-[94px] textShadow '>
                {rulesPage.titleLine1} <br/>
                  {rulesPage.titleLine2}
              </h1>
            </div>
        </div>
        <div className="main_container text-lightgrey text-xl pt-14">
          <b className='text-3xl'>{rulesPage.intro}</b>
          <ul className="list-disc mt-3 pl-6">
            {rulesPage.items.map((item) => (
              <li key={item} className='mt-2'>{item}</li>
            ))}
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