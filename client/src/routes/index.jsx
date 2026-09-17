import { lazy, Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from './ProtectedRoute';
import { Spinner } from '../components/ui';
import PublicLayout from '../layouts/PublicLayout';
import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import AssistantPanel from '../features/assistant/AssistantPanel';

// Public pages are eager: they are the first thing a visitor loads.
import HomePage from '../pages/public/HomePage';
import ExposPage from '../pages/public/ExposPage';
import ExpoDetailPage from '../pages/public/ExpoDetailPage';
import ExhibitorsPage from '../pages/public/ExhibitorsPage';
import ExhibitorDetailPage from '../pages/public/ExhibitorDetailPage';
import SchedulePage from '../pages/public/SchedulePage';
import SessionDetailPage from '../pages/public/SessionDetailPage';
import NotFoundPage from '../pages/public/NotFoundPage';
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';

// Everything behind a login is code-split so the landing page stays fast.
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));
const AdminAnalytics = lazy(() => import('../pages/admin/AdminAnalytics'));
const AdminExpos = lazy(() => import('../pages/admin/AdminExpos'));
const AdminAttendees = lazy(() => import('../pages/admin/AdminAttendees'));
const AdminExhibitors = lazy(() => import('../pages/admin/AdminExhibitors'));
const AdminBooths = lazy(() => import('../pages/admin/AdminBooths'));
const AdminFloorPlans = lazy(() => import('../pages/admin/AdminFloorPlans'));
const AdminSchedule = lazy(() => import('../pages/admin/AdminSchedule'));
const AdminSessions = lazy(() => import('../pages/admin/AdminSessions'));
const AdminAnnouncements = lazy(() => import('../pages/admin/AdminAnnouncements'));
const AdminAppointments = lazy(() => import('../pages/admin/AdminAppointments'));
const AdminPayments = lazy(() => import('../pages/admin/AdminPayments'));
const AdminCheckIn = lazy(() => import('../pages/admin/AdminCheckIn'));
const AdminFeedback = lazy(() => import('../pages/admin/AdminFeedback'));
const AdminSupport = lazy(() => import('../pages/admin/AdminSupport'));
const AdminUsers = lazy(() => import('../pages/admin/AdminUsers'));
const AdminSettings = lazy(() => import('../pages/admin/AdminSettings'));

const ExhibitorDashboard = lazy(() => import('../pages/exhibitor/ExhibitorDashboard'));
const ExhibitorAnalytics = lazy(() => import('../pages/exhibitor/ExhibitorAnalytics'));
const ExhibitorApplications = lazy(() => import('../pages/exhibitor/ExhibitorApplications'));
const ExhibitorBooth = lazy(() => import('../pages/exhibitor/ExhibitorBooth'));
const ExhibitorFloorPlan = lazy(() => import('../pages/exhibitor/ExhibitorFloorPlan'));
const ExhibitorCompany = lazy(() => import('../pages/exhibitor/ExhibitorCompany'));
const ExhibitorProducts = lazy(() => import('../pages/exhibitor/ExhibitorProducts'));
const ExhibitorVisitors = lazy(() => import('../pages/exhibitor/ExhibitorVisitors'));
const ExhibitorAppointments = lazy(() => import('../pages/exhibitor/ExhibitorAppointments'));
const ExhibitorAvailability = lazy(() => import('../pages/exhibitor/ExhibitorAvailability'));
const ExhibitorReviews = lazy(() => import('../pages/exhibitor/ExhibitorReviews'));
const ExhibitorPayments = lazy(() => import('../pages/exhibitor/ExhibitorPayments'));
const ExhibitorSettings = lazy(() => import('../pages/exhibitor/ExhibitorSettings'));

const AttendeeDashboard = lazy(() => import('../pages/attendee/AttendeeDashboard'));
const AttendeeExpos = lazy(() => import('../pages/attendee/AttendeeExpos'));
const AttendeePass = lazy(() => import('../pages/attendee/AttendeePass'));
const AttendeeSessions = lazy(() => import('../pages/attendee/AttendeeSessions'));
const AttendeeBookmarks = lazy(() => import('../pages/attendee/AttendeeBookmarks'));
const AttendeeAppointments = lazy(() => import('../pages/attendee/AttendeeAppointments'));
const AttendeeFloorPlan = lazy(() => import('../pages/attendee/AttendeeFloorPlan'));
const AttendeeReviews = lazy(() => import('../pages/attendee/AttendeeReviews'));
const AttendeePayments = lazy(() => import('../pages/attendee/AttendeePayments'));
const AttendeeFeedback = lazy(() => import('../pages/attendee/AttendeeFeedback'));
const AttendeeSupport = lazy(() => import('../pages/attendee/AttendeeSupport'));
const AttendeeProfile = lazy(() => import('../pages/attendee/AttendeeProfile'));

const MessagesPage = lazy(() => import('../pages/shared/MessagesPage'));
const NotificationsPage = lazy(() => import('../pages/shared/NotificationsPage'));

const RouteLoader = () => (
  <div className="flex min-h-[50vh] items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
    <Spinner size="lg" />
    <span className="text-sm font-medium">Loading…</span>
  </div>
);

const AppRoutes = () => {
  const location = useLocation();

  return (
    <>
      <Suspense fallback={<RouteLoader />}>
        <Routes location={location}>
          {/* ------------------------------------------------ public site */}
          <Route element={<PublicLayout />}>
            <Route index element={<HomePage />} />
            <Route path="expos" element={<ExposPage />} />
            <Route path="expos/:id" element={<ExpoDetailPage />} />
            <Route path="exhibitors" element={<ExhibitorsPage />} />
            <Route path="exhibitors/:id" element={<ExhibitorDetailPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="sessions/:id" element={<SessionDetailPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          {/* --------------------------------------------------- auth ----- */}
          <Route element={<AuthLayout />}>
            <Route
              path="login"
              element={
                <PublicOnlyRoute>
                  <LoginPage />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="register"
              element={
                <PublicOnlyRoute>
                  <RegisterPage />
                </PublicOnlyRoute>
              }
            />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password/:token" element={<ResetPasswordPage />} />
          </Route>

          {/* -------------------------------------------------- organizer -- */}
          <Route path="admin" element={<ProtectedRoute roles={['admin']}><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="expos" element={<AdminExpos />} />
            <Route path="attendees" element={<AdminAttendees />} />
            <Route path="exhibitors" element={<AdminExhibitors />} />
            <Route path="booths" element={<AdminBooths />} />
            <Route path="floor-plans" element={<AdminFloorPlans />} />
            <Route path="schedule" element={<AdminSchedule />} />
            <Route path="sessions" element={<AdminSessions />} />
            <Route path="announcements" element={<AdminAnnouncements />} />
            <Route path="appointments" element={<AdminAppointments />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="check-in" element={<AdminCheckIn />} />
            <Route path="feedback" element={<AdminFeedback />} />
            <Route path="support" element={<AdminSupport />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          {/* ------------------------------------------------ exhibitors -- */}
          <Route path="exhibitor" element={<ProtectedRoute roles={['exhibitor']}><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<ExhibitorDashboard />} />
            <Route path="analytics" element={<ExhibitorAnalytics />} />
            <Route path="applications" element={<ExhibitorApplications />} />
            <Route path="booth" element={<ExhibitorBooth />} />
            <Route path="floor-plan" element={<ExhibitorFloorPlan />} />
            <Route path="company" element={<ExhibitorCompany />} />
            <Route path="products" element={<ExhibitorProducts />} />
            <Route path="visitors" element={<ExhibitorVisitors />} />
            <Route path="appointments" element={<ExhibitorAppointments />} />
            <Route path="availability" element={<ExhibitorAvailability />} />
            <Route path="reviews" element={<ExhibitorReviews />} />
            <Route path="payments" element={<ExhibitorPayments />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<ExhibitorSettings />} />
          </Route>

          {/* -------------------------------------------------- attendees -- */}
          <Route path="attendee" element={<ProtectedRoute roles={['attendee']}><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<AttendeeDashboard />} />
            <Route path="expos" element={<AttendeeExpos />} />
            <Route path="pass" element={<AttendeePass />} />
            <Route path="sessions" element={<AttendeeSessions />} />
            <Route path="bookmarks" element={<AttendeeBookmarks />} />
            <Route path="appointments" element={<AttendeeAppointments />} />
            <Route path="floor-plan" element={<AttendeeFloorPlan />} />
            <Route path="reviews" element={<AttendeeReviews />} />
            <Route path="payments" element={<AttendeePayments />} />
            <Route path="feedback" element={<AttendeeFeedback />} />
            <Route path="support" element={<AttendeeSupport />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<AttendeeProfile />} />
          </Route>
        </Routes>
      </Suspense>
      <AssistantPanel />
    </>
  );
};

export default AppRoutes;
