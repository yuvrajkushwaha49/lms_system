import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/admin/Login';
import DashboardSectionPage from './pages/admin/DashboardSectionPage';
import UserManagementPage from './pages/admin/UserManagementPage';
import UserDetailPage from './pages/admin/UserDetailPage';
import Register from './pages/admin/Register';
import StudentPanel from './pages/student/StudentPanel';
import StudentCourseDetailPage from './pages/student/StudentCourseDetailPage';
import StudentDashboard from './pages/student/SutdentDashboard';
import StudentStartHerePage from './pages/student/StudentStartHerePage';
import StudentStarterPlaceholderPage from './pages/student/StudentStarterPlaceholderPage';
import StudentMeetGreetPage from './pages/student/StudentMeetGreetPage';
import StudentFaqsPage from './pages/student/StudentFaqsPage';
import StudentMembersPage from './pages/student/StudentMembersPage';
import StudentAccountSettingsPage from './pages/student/StudentAccountSettingsPage';
import StudentMessagesPage from './pages/student/StudentMessagesPage';
import SellItSnackDetailPage from './pages/student/SellItSnackDetailPage';
import SellItSnacksViewerPage from './pages/student/SellItSnacksViewerPage';
import TrannerManagementPage from './pages/admin/TrainerManagementPage';
import TrainerDashboard from './pages/trainer/TrainerDashboard';
import TrainerDashboardSectionPage from './pages/trainer/TrainerDashboardSectionPage';
import TrainerSellItSnacksPage from './pages/trainer/TrainerSellItSnacksPage';
import MemberManagementPage from './pages/admin/MemberManagementPage';
import CourseManagementPage from './pages/admin/CourseManagementPage';
import CourseDetailPage from './pages/admin/CourseDetailPage';
import AdminCourseVideoDetailPage from './pages/admin/AdminCourseVideoDetailPage';
import AdminOwningManhattanDetailPage from './pages/admin/AdminOwningManhattanDetailPage';
import WorkshopManagementPage from './pages/admin/WorkshopManagementPage';
import NewsManagementPage from './pages/admin/NewsManagementPage';
import PartnerManagementPage from './pages/admin/PartnerManagementPage';
import DocumentCenterManagementPage from './pages/admin/DocumentCenterManagementPage';
import TrainerCoursePage from './pages/trainer/TrainerCoursePage';
import TrainerCourseDetailPage from './pages/trainer/TrainerCourseDetailPage';
import TrainerCourseVideoDetailPage from './pages/trainer/TrainerCourseVideoDetailPage';
import StudentCommunityHubPage from './pages/student/StudentCommunityHubPage';
import StudentCommunityReferralPartnersPage from './pages/student/StudentCommunityReferralPartnersPage';
import StudentCommunityListingsPage from './pages/student/StudentCommunityListingsPage';
import TrainerCommunityFeedPage from './pages/trainer/TrainerCommunityFeedPage';
import SuperAdminCommunityFeedPage from './pages/admin/SuperAdminCommunityFeedPage';
import AdminCommunityHubPage from './pages/admin/AdminCommunityHubPage';
import AdminCommunityReferralPartnersPage from './pages/admin/AdminCommunityReferralPartnersPage';
import AdminCommunityListingsPage from './pages/admin/AdminCommunityListingsPage';
import AdminSellItCommunityReportsPage from './pages/admin/AdminSellItCommunityReportsPage';
import SuperAdminFeedReportsPage from './pages/admin/SuperAdminFeedReportsPage';
import SuperAdminFeedReportDetailPage from './pages/admin/SuperAdminFeedReportDetailPage';
import SuperAdminFeedByMembersPage from './pages/admin/SuperAdminFeedByMembersPage';
import AdminSellItSnacksPage from './pages/admin/AdminSellItSnacksPage';
import FaqManagementPage from './pages/admin/FaqManagementPage';
import StudentWallOfWinsPage from './pages/student/StudentWallOfWinsPage';
import SuperAdminWallOfWinsPage from './pages/admin/SuperAdminWallOfWinsPage';
import WallOfWinsDetailPage, { AdminWallOfWinsDetailPage } from './pages/admin/WallOfWinsDetailPage';
import WelcomeSellItFamilyPage from './pages/student/WelcomeSellItFamilyPage';
import TrainerWelcomeSellItFamilyPage from './pages/trainer/TrainerWelcomeSellItFamilyPage';
import TrainerStarterPlaceholderPage from './pages/trainer/TrainerStarterPlaceholderPage';
import TrainerStartHerePage from './pages/trainer/TrainerStartHerePage';
import WelcomeVideoManagementPage from './pages/admin/WelcomeVideoManagementPage';
import AdminWelcomeNavPlaceholderPage from './pages/admin/AdminWelcomeNavPlaceholderPage';
import StudentAskRyanPage from './pages/student/StudentAskRyanPage';
import StudentCoursesByMonthPage from './pages/student/StudentCoursesByMonthPage';
import TrainerAskRyanPage from './pages/trainer/TrainerAskRyanPage';
import AdminAskRyanManagementPage from './pages/admin/AdminAskRyanManagementPage';
import AdminMonthlyChallengesManagementPage from './pages/admin/AdminMonthlyChallengesManagementPage';
import AdminMonthlyChallengeDetailPage from './pages/admin/AdminMonthlyChallengeDetailPage';

function App() {
  return (
    <div className="min-vh-100">
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Navigate to="/dashboard/user-management" replace />} />
          <Route path="/dashboard/student-panel" element={<StudentPanel />} />
          <Route path="/dashboard/student-course" element={<StudentPanel />} />
          <Route path="/dashboard/student-course/:courseId" element={<StudentCourseDetailPage />} />
          <Route path="/dashboard/student-start-here" element={<StudentStartHerePage />} />
          <Route path="/dashboard/student-welcome-family" element={<WelcomeSellItFamilyPage />} />
          <Route path="/dashboard/student-meet-greet" element={<StudentMeetGreetPage />} />
          <Route path="/dashboard/student-ask-ryan" element={<StudentAskRyanPage />} />
          <Route path="/dashboard/student-courses-by-month" element={<StudentCoursesByMonthPage />} />
          <Route
            path="/dashboard/student-owning-manhattan"
            element={<StudentPanel />}
          />
          <Route
            path="/dashboard/student-sell-it-snacks"
            element={<SellItSnacksViewerPage />}
          />
          <Route path="/dashboard/student-sell-it-snacks/:snackId" element={<SellItSnackDetailPage />} />
          <Route
            path="/dashboard/student-live-workshops"
            element={<StudentStarterPlaceholderPage title="Live Workshops" description="Upcoming and recorded workshop sessions will appear here." />}
          />
          <Route path="/dashboard/student-wall-of-wins" element={<StudentWallOfWinsPage />} />
          <Route path="/dashboard/student-wall-of-wins/:entryId" element={<WallOfWinsDetailPage />} />
          <Route
            path="/dashboard/student-faqs"
            element={<StudentFaqsPage />}
          />
          <Route path="/dashboard/student-members" element={<StudentMembersPage />} />
          <Route path="/dashboard/student-account-settings" element={<StudentAccountSettingsPage />} />
          <Route path="/dashboard/student-messages" element={<StudentMessagesPage />} />
          <Route
            path="/dashboard/student-community/referral-partners"
            element={<StudentCommunityReferralPartnersPage />}
          />
          <Route path="/dashboard/student-community/listings" element={<StudentCommunityListingsPage />} />
          <Route path="/dashboard/student-community" element={<StudentCommunityHubPage />} />
          <Route path="/dashboard/student-dashboard" element={<StudentDashboard />} />
          <Route path="/dashboard/user-management/:userId" element={<UserDetailPage />} />
          <Route path="/dashboard/user-management" element={<UserManagementPage />} />
          <Route path="/dashboard/members-management" element={<MemberManagementPage />} />
          <Route path="/dashboard/trainer-management" element={<TrannerManagementPage title="Trainer Management" />} />
          <Route path="/dashboard/trainer-dashboard" element={<TrainerDashboard />} />
          <Route path="/dashboard/trainer-start-here" element={<TrainerStartHerePage />} />
          <Route path="/dashboard/trainer-welcome-family" element={<TrainerWelcomeSellItFamilyPage />} />
          <Route
            path="/dashboard/trainer-meet-greet"
            element={<TrainerStarterPlaceholderPage title="Meet + Greet" description="Coming soon." />}
          />
          <Route path="/dashboard/trainer-ask-ryan" element={<TrainerAskRyanPage />} />
          <Route
            path="/dashboard/trainer-owning-manhattan"
            element={<TrainerCoursePage />}
          />
          <Route path="/dashboard/trainer-sell-it-snacks" element={<TrainerSellItSnacksPage />} />
          <Route
            path="/dashboard/trainer-sell-it-snacks/:snackId"
            element={(
              <SellItSnackDetailPage
                SectionComponent={TrainerDashboardSectionPage}
                backPath="/dashboard/trainer-sell-it-snacks"
                detailBasePath="/dashboard/trainer-sell-it-snacks"
                showHeroOverview
              />
            )}
          />
          <Route path="/dashboard/trainer-feed" element={<TrainerCommunityFeedPage />} />
          <Route path="/dashboard/trainer-course-video-detail/:courseId/:videoId" element={<TrainerCourseVideoDetailPage />} />
          <Route path="/dashboard/member-management" element={<Navigate to="/dashboard/members-management" replace />} />
          <Route path="/dashboard/course-management" element={<CourseManagementPage />} />
          <Route path="/dashboard/course-management/:courseId" element={<CourseDetailPage />} />
          <Route path="/dashboard/owning-manhattan/:courseId" element={<AdminOwningManhattanDetailPage />} />
          <Route path="/dashboard/course-management/:courseId/videos/:videoId" element={<AdminCourseVideoDetailPage />} />
          <Route path="/dashboard/sell-it-snacks-management" element={<AdminSellItSnacksPage />} />
          <Route path="/dashboard/trainer-course" element={<TrainerCoursePage />} />
          <Route path="/dashboard/trainer-course/:courseId" element={<TrainerCourseDetailPage />} />
          <Route path="/dashboard/workshop-management" element={<WorkshopManagementPage />} />
          <Route
            path="/dashboard/admin-community/referral-partners"
            element={<AdminCommunityReferralPartnersPage />}
          />
          <Route path="/dashboard/admin-community/listings" element={<AdminCommunityListingsPage />} />
          <Route path="/dashboard/admin-community/reports/:reportId" element={<SuperAdminFeedReportDetailPage />} />
          <Route path="/dashboard/admin-community/reports" element={<AdminSellItCommunityReportsPage />} />
          <Route path="/dashboard/admin-community/recent" element={<AdminCommunityHubPage />} />
          <Route path="/dashboard/admin-community" element={<Navigate to="/dashboard/admin-community/recent" replace />} />
          <Route path="/dashboard/feed-management" element={<Navigate to="/dashboard/feed-management/recent" replace />} />
          <Route path="/dashboard/feed-management/recent" element={<SuperAdminCommunityFeedPage />} />
          <Route path="/dashboard/feed-management/reports" element={<SuperAdminFeedReportsPage />} />
          <Route path="/dashboard/feed-management/reports/:reportId" element={<SuperAdminFeedReportDetailPage />} />
          <Route path="/dashboard/feed-management/members" element={<SuperAdminFeedByMembersPage />} />
          <Route path="/dashboard/feed-management/wall-of-wins" element={<SuperAdminWallOfWinsPage />} />
          <Route path="/dashboard/feed-management/wall-of-wins/:entryId" element={<AdminWallOfWinsDetailPage />} />
          <Route path="/dashboard/news-management" element={<NewsManagementPage />} />
          <Route path="/dashboard/faqs-management" element={<FaqManagementPage />} />
          <Route path="/dashboard/welcome-video-management" element={<WelcomeVideoManagementPage />} />
          <Route path="/dashboard/welcome-admin/:section" element={<AdminWelcomeNavPlaceholderPage />} />
          <Route path="/dashboard/ask-ryan-management" element={<AdminAskRyanManagementPage />} />
          <Route path="/dashboard/monthly-challenges-management" element={<AdminMonthlyChallengesManagementPage />} />
          <Route
            path="/dashboard/monthly-challenges-management/:monthKey"
            element={<AdminMonthlyChallengeDetailPage />}
          />
          <Route path="/dashboard/partner-management" element={<PartnerManagementPage />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard/document-center-management"
            element={<DocumentCenterManagementPage />}
          />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
