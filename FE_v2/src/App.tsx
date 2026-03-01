import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { MainLayout } from "./layouts/MainLayout";
import { AdminLayout } from "./layouts/AdminLayout";
import { CustomerLayout } from "./layouts/CustomerLayout";
import { ExpertLayout } from "./layouts/ExpertLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RoleProtectedRoute } from "./components/RoleProtectedRoute";
import { Toaster } from "./components/ui/toaster";

// Public pages
import Landing from "./pages/public/Landing";
import About from "./pages/public/About";
import Services from "./pages/public/Services";
import Rules from "./pages/public/Rules";
import Contact from "./pages/public/Contact";
import VideoDemo from "./pages/public/VideoDemo";

// Auth pages
import LoginPage from "./pages/auth/Login";
import RegisterCustomer from "./pages/auth/RegisterCustomer";
import RegisterExpert from "./pages/auth/RegisterExpert";
import ForgotPassword from "./pages/auth/ForgotPassword";
import VerifyEmail from "./pages/auth/VerifyEmail";

// Customer pages
import CustomerHome from "./pages/customer/Home";
import CustomerProfile from "./pages/customer/Profile";
import CustomerSearch from "./pages/customer/Search";
import CustomerSeminars from "./pages/customer/Seminars";
import CustomerCalendar from "./pages/customer/Calendar";
import CustomerEvents from "./pages/customer/Events";
import CustomerPayments from "./pages/customer/Payments";

// Expert pages
import ExpertHome from "./pages/expert/Home";
import ExpertProfile from "./pages/expert/Profile";
import ExpertSearch from "./pages/expert/Search";
import ExpertAvailability from "./pages/expert/Availability";
import ExpertSeminars from "./pages/expert/Seminars";
import ExpertCalendar from "./pages/expert/Calendar";
import ExpertEvents from "./pages/expert/Events";

// Shared dashboard pages
import Messenger from "./pages/shared/Messenger";
import VideoRoom from "./pages/shared/VideoRoom";
import Friends from "./pages/shared/Friends";
import SharedSettings from "./pages/shared/Settings";

// Dev pages
import DesignSystem from "./pages/dev/DesignSystem";

// Admin pages
import { AdminOverview } from "./pages/Admin/Overview";
import { UserManagement } from "./pages/Admin/UserManagement";
import { Settings as AdminSettings } from "./pages/Admin/Settings";
import { AdminPayments } from "./pages/Admin/Payments";
import { AdminChats } from "./pages/Admin/Chats";
import { AdminChatbot } from "./pages/Admin/Chatbot";
import { AdminContacts } from "./pages/Admin/Contacts";
import { AdminFeedbacks } from "./pages/Admin/Feedbacks";

export function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <Routes>

        {/* ── Public routes ── */}
        <Route
          path="/"
          element={<MainLayout><Landing /></MainLayout>}
        />
        <Route
          path="/about"
          element={<MainLayout><About /></MainLayout>}
        />
        <Route
          path="/services"
          element={<MainLayout><Services /></MainLayout>}
        />
        <Route
          path="/rules"
          element={<MainLayout><Rules /></MainLayout>}
        />
        <Route
          path="/contact"
          element={<MainLayout><Contact /></MainLayout>}
        />
        {/* ── Demo routes (public, no auth required) ── */}
        <Route
          path="/demo/video"
          element={<MainLayout><VideoDemo /></MainLayout>}
        />

        {/* ── Auth routes ── */}
        <Route
          path="/login"
          element={<MainLayout><LoginPage /></MainLayout>}
        />
        <Route
          path="/register/customer"
          element={<MainLayout><RegisterCustomer /></MainLayout>}
        />
        <Route
          path="/register/expert"
          element={<MainLayout><RegisterExpert /></MainLayout>}
        />
        <Route
          path="/forgot-password"
          element={<MainLayout><ForgotPassword /></MainLayout>}
        />
        <Route
          path="/verify-email"
          element={<MainLayout><VerifyEmail /></MainLayout>}
        />

        {/* ── Customer dashboard ── */}
        <Route
          path="/dashboard/customer"
          element={
            <ProtectedRoute>
              <RoleProtectedRoute allowedRoles={["customer"]}>
                <CustomerLayout />
              </RoleProtectedRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<CustomerHome />} />
          <Route path="profile" element={<CustomerProfile />} />
          <Route path="search" element={<CustomerSearch />} />
          <Route path="seminars" element={<CustomerSeminars />} />
          <Route path="calendar" element={<CustomerCalendar />} />
          <Route path="events" element={<CustomerEvents />} />
          <Route path="payments" element={<CustomerPayments />} />
        </Route>

        {/* ── Expert dashboard ── */}
        <Route
          path="/dashboard/expert"
          element={
            <ProtectedRoute>
              <RoleProtectedRoute allowedRoles={["expert"]}>
                <ExpertLayout />
              </RoleProtectedRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<ExpertHome />} />
          <Route path="profile" element={<ExpertProfile />} />
          <Route path="search" element={<ExpertSearch />} />
          <Route path="availability" element={<ExpertAvailability />} />
          <Route path="seminars" element={<ExpertSeminars />} />
          <Route path="calendar" element={<ExpertCalendar />} />
          <Route path="events" element={<ExpertEvents />} />
        </Route>

        {/* ── Shared dashboard routes (any authenticated role) ── */}
        <Route
          path="/dashboard/messenger"
          element={
            <ProtectedRoute>
              <Messenger />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/video/:roomId"
          element={
            <ProtectedRoute>
              <VideoRoom />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/friends"
          element={
            <ProtectedRoute>
              <Friends />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/settings"
          element={
            <ProtectedRoute>
              <SharedSettings />
            </ProtectedRoute>
          }
        />

        {/* ── Admin dashboard ── */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <RoleProtectedRoute allowedRoles={["admin"]}>
                <MainLayout>
                  <AdminLayout />
                </MainLayout>
              </RoleProtectedRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="chats" element={<AdminChats />} />
          <Route path="chatbot" element={<AdminChatbot />} />
          <Route path="contacts" element={<AdminContacts />} />
          <Route path="feedbacks" element={<AdminFeedbacks />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        {/* ── Dev routes ── */}
        <Route path="/design-system" element={<DesignSystem />} />

        {/* ── Legacy /dashboard redirect — send users to role-appropriate home ── */}
        <Route path="/dashboard" element={<Navigate to="/login" replace />} />

        {/* ── Catch-all ── */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}

