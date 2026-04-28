import React, { useEffect, useState, Suspense } from 'react';
import { useDispatch } from "react-redux";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import AlertNotification from "./components/AlertNotification"
import { useAppSelector } from './store';
import Loading from './components/Loading';
import { CurrentUser, actionTypes } from './actions/types';
import Header from './components/header';
import LandingFooter from './components/landingFooter';
import { updateLocation } from './actions/appActions';
import { siteMap } from './actions/siteMap';
import { isTheEventGoingOn } from './actions/common';
import { autoLogin } from './actions/authActions';
import { connectToRC, isRCConnected } from './services/rcRealtime';
import 'swiper/swiper.min.css';
import LeaveFeedback from './components/LeaveFeedback';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';

// Lazy-loaded pages — only downloaded when the user navigates to them
const StudentDashboard = React.lazy(() => import('./pages/StudentDashboard'));
const ExpertDashboard = React.lazy(() => import('./pages/ExpertDashboard'));
const WLLogin = React.lazy(() => import('./pages/WLLogin'));
const WLCustomerRegister = React.lazy(() => import('./pages/WLCustomerRegister'));
const WLExpertRegister = React.lazy(() => import('./pages/WLExpertRegister'));
const TOEConsulting = React.lazy(() => import('./pages/TOEConsulting'));
const AboutUS = React.lazy(() => import('./pages/AboutUS'));
const Rules = React.lazy(() => import('./pages/Ruels'));
const Services = React.lazy(() => import('./pages/Services'));
const ContactUS = React.lazy(() => import('./pages/ContactUS'));
const OAuthCallback = React.lazy(() => import('./pages/OAuthCallback'));
const WLProfileCompletion = React.lazy(() => import('./pages/WLProfileCompletion'));
const MeetingGuestInvite = React.lazy(() => import('./pages/MeetingGuestInvite'));

// Heavy dashboard chunks — MUI, calendars, quill, etc. only load after login
const LegacyExpertDashboard = React.lazy(() => import('./pages/Dashboard/_ExpertDashboard'));
const CustomerDashboard = React.lazy(() => import('./pages/Dashboard/_CustomerDashboard'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));

// Suspense fallback
const LazyFallback = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
    <div style={{ width: 40, height: 40, border: '3px solid #D9EAFD', borderTopColor: '#234C6A', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
  </div>
);

const UnauthenticatedRoutes = () => {
  return (
    <React.Fragment>
      <Routes>
        <Route path="/oauth-callback" element={<OAuthCallback />} />
        <Route path="/auth-complete-profile" element={<WLProfileCompletion />} />
        <Route path="/customerregister" element={<WLCustomerRegister />} />
        <Route path="/expertregister" element={<WLExpertRegister />} />
        <Route path="/forgotpassword" element={<ForgotPassword />} />
        <Route path="/verification/:email/:confirmCode" element={<VerifyEmail />} />
        <Route path="/meeting/invite/:token" element={<MeetingGuestInvite />} />
        <Route path="/login" element={<WLLogin />} />
        <Route path="/aboutus" element={
          <React.Fragment>
            <Header />
            <AboutUS />
            <LandingFooter />
          </React.Fragment>
        } />
        <Route path="/rules" element={
          <React.Fragment>
            <Header />
            <Rules />
            <LandingFooter />
          </React.Fragment>
        } />
        <Route path="/services" element={
          <React.Fragment>
            <Header />
            <Services />
            <LandingFooter />
          </React.Fragment>
        } />
        <Route path="/contactus" element={
          <React.Fragment>
            <Header />
            <ContactUS />
            <LandingFooter />
          </React.Fragment>
        } />
        <Route path="/*" element={<TOEConsulting />} />
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
      <Route path={'expertdashboard-legacy/*'} element={
        <PrivateRoute>
          <LegacyExpertDashboard />
        </PrivateRoute>
      } />
      <Route path={'studentdashboard/*'} element={
        <PrivateRoute>
          <StudentDashboard />
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
  const storedUser = localStorage.getItem("currentUser");
  const currentUser: CurrentUser = JSON.parse(
    storedUser && storedUser !== "undefined" ? storedUser : "{}"
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
      <Navigate to={'/' + 'login'} replace /> :
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
    const storedUser = localStorage.getItem("currentUser");
    const currentUser: CurrentUser = JSON.parse(
      storedUser && storedUser !== "undefined" ? storedUser : "{}"
    );
    const isLoginRemembered = localStorage.getItem("isLoginRemembered")
    if (currentUser.email && isLoginRemembered === "true") {
      dispatch(autoLogin());
    }
  }, [dispatch])

  useEffect(() => {
    if (!userDetails?.email) return;
    if (isRCConnected()) return;
    connectToRC().catch(() => {});
  }, [userDetails?.email])

  useEffect(() => {
    if (!oldUserDetails && userDetails?.email) {
      set_oldUserDetails(userDetails)
      
      const path = window.location.pathname;
      const search = window.location.search;
      if (
        path.includes('/oauth-callback') || 
        path.includes('/verification/') || 
        path.includes('/auth-complete-profile') ||
        (path.includes('/login') && search.includes('error='))
      ) {
        return;
      }
      if (path.includes('/login')) {
        const redirectPath = new URLSearchParams(search).get('redirect') || '';
        if (redirectPath.startsWith('/')) {
          navigate(redirectPath);
          return;
        }
      }

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
        if (userDetails?.role === 'customer') {
          navigate('/user/studentdashboard')
        } else {
          navigate('/user/' + userDetails?.role + "dashboard")
        }
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
      <Suspense fallback={<LazyFallback />}>
        
          <Routes>
            <Route path={'/user/' + '*'} element={<AuthenticatedRoutes />} />
            <Route path={'/' + '*'} element={<UnauthenticatedRoutes />} />
          </Routes>
          <AlertNotification />
          <LeaveFeedback />
          <Loading loading={loading} />
        
      </Suspense>
    </>
  );
}

export default App;
