import React, { useEffect, useState } from 'react';
import { useDispatch } from "react-redux";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import Login from './pages/logIn';
import CustomerRegister from './pages/CustomerRegister';
import AlertNotification from "./components/AlertNotification"
import { useAppSelector } from './store';
import Loading from './components/Loading';
import { CurrentUser, actionTypes } from './actions/types';
import LandingPage from './pages/Landing';
import AboutUS from './pages/AboutUS';
import Header from './components/header';
import LandingFooter from './components/landingFooter';
import Rules from './pages/Ruels';
import Services from './pages/Services';
import ContactUS from './pages/ContactUS';
import ExpertRegister from './pages/ExpertRegister';
import ExpertDashboard from './pages/Dashboard/_ExpertDashboard';
import CustomerDashboard from './pages/Dashboard/_CustomerDashboard';
import { updateLocation } from './actions/appActions';
import { siteMap } from './actions/siteMap';
import { isTheEventGoingOn } from './actions/common';
import { autoLogin } from './actions/authActions';
import 'swiper/swiper.min.css';
import { checkLocalAudioVideoStreams } from './socket/webRTC';
import LeaveFeedback from './components/LeaveFeedback';
import AdminDashboard from './pages/Dashboard/_AdminDashboard';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import { VideoChatProvider } from './components/VideoChat/VideoChatContext';


const UnauthenticatedRoutes = () => {
  return (
    <React.Fragment>
      <Routes>
        <Route path="/customerregister" element={<CustomerRegister />} />
        <Route path="/expertregister" element={<ExpertRegister />} />
        <Route path="/forgotpassword" element={<ForgotPassword />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verification/:email/:confirmCode" element={<VerifyEmail />} />
        <Route path="/*" element={
          <React.Fragment>
            <Header />
            <Routes>
              <Route path="/aboutus" element={<AboutUS />} />
              <Route path="/rules" element={<Rules />} />
              <Route path="/services" element={<Services />} />
              <Route path="/contactus" element={<ContactUS />} />
              <Route path="/*" element={<LandingPage />} />
            </Routes>
            <LandingFooter />
          </React.Fragment>
        } />
      </Routes>
    </React.Fragment>
  )
};

const AuthenticatedRoutes = () => {
  return (
    <Routes>
      {/* AUTHENTICATED ROUTES */}
      <Route path={'expertdashboard/*'} element={
        <PrivateRoute>
          <ExpertDashboard />
        </PrivateRoute>
      } />
      <Route path={'customerdashboard/*'} element={
        <PrivateRoute>
          <CustomerDashboard />
        </PrivateRoute>
      } />
      <Route path={'admindashboard/*'} element={
        <PrivateRoute>
          <AdminDashboard />
        </PrivateRoute>
      } />
    </Routes>
  )
};

const PrivateRoute = ({ children }: any) => {
  const dispatch = useDispatch()
  const { auth: { userDetails } } = useAppSelector((state) => state);
  // PRIVATE ROUTE --------------
  const currentUser: CurrentUser = JSON.parse(
    localStorage.getItem("currentUser") || "{}"
  );
  if (currentUser?.email && !userDetails?.email) {
    dispatch({
      type: actionTypes.authenticate,
      payload: currentUser
    })
  }

  // const checkEnabledEvent = () => {
  //   let count = 0
  //   for (let i = 0; i < userDetails?.events?.length; i++) {
  //     count++
  //     if (userDetails?.events?.[i].status === 'accepted') {
  //       if (isTheEventGoingOn(userDetails?.events?.[i].start, userDetails?.events?.[i].end)) {
  //         // TODO --- one event enabled
  //         return;
  //       }
  //     }
  //   }
  //   if (count === userDetails?.events?.length) {
  //     // TODO --- no enabled event
  //   }
  // }

  // useEffect(() => {
  //   const intervalId = setInterval(checkEnabledEvent, 5000);
  //   return () => {
  //     clearInterval(intervalId);
  //   };
  // }, [userDetails])

  return (
    !currentUser?.email ?
      <Navigate to={import.meta.env.VITE_BASE_URL + 'login'} replace /> :
      userDetails?.email ?
        children :
        null
  )
};

function App() {

  const dispatch = useDispatch();
  const navigate = useNavigate()
  const { auth: { userDetails }, app: { loading } } = useAppSelector(state => state);
  const [oldUserDetails, set_oldUserDetails] = useState(userDetails)

  useEffect(() => {
    const currentUser: CurrentUser = JSON.parse(
      localStorage.getItem("currentUser") || "{}"
    );
    const isLoginRemembered = localStorage.getItem("isLoginRemembered")
    if (currentUser.email && isLoginRemembered === "true") {
      dispatch(autoLogin());
    }
  }, [dispatch])

  useEffect(() => {
    if (!oldUserDetails && userDetails?.email) {
      set_oldUserDetails(userDetails)
      let locationUrl = ''
      const location = localStorage.getItem("location")
      if (location !== 'login' && location !== 'expertregister' && location !== 'customerregister') {
        for (const key in siteMap) {
          if (siteMap[key] === location) {
            locationUrl = key
          }
        }
      }
      if (locationUrl) {
        navigate(locationUrl)
      } else {
        navigate(import.meta.env.VITE_AUTH_URL + userDetails?.role + "dashboard")
      }
    }
  }, [userDetails, navigate])

  const location = useLocation()
  useEffect(() => {
    if (siteMap[location.pathname]) {
      dispatch(updateLocation(siteMap[location.pathname]))
    }
  }, [location])



  const checkStreams = () => {
    checkLocalAudioVideoStreams()
  }

  useEffect(() => {
    // checkStreams()
    // const intervalId = setInterval(checkStreams, 5000);
    // return () => {
    //     clearInterval(intervalId);
    // };
  }, [])

  return (
    <>
    <VideoChatProvider>
      <Routes>
        <Route path={import.meta.env.VITE_AUTH_URL + '*'} element={<AuthenticatedRoutes />} />
        <Route path={import.meta.env.VITE_BASE_URL + '*'} element={<UnauthenticatedRoutes />} />
      </Routes>
      <AlertNotification />
      <LeaveFeedback />
      <Loading loading={loading} />
      </VideoChatProvider>
    </>
  );
}

export default App;
