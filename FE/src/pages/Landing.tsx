import React from "react"
import LandingHero from '../components/landingHero';
import LandingSolution from '../components/landingSolution';
import LandingTestimonial from '../components/landingTestimonial';

const LandingPage = () => {
    return (
      <React.Fragment>
        <LandingHero />
        <LandingSolution />
        <LandingTestimonial />
      </React.Fragment>
    )
}

export default LandingPage