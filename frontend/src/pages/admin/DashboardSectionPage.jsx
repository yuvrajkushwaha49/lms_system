import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  FiBookOpen,
  FiBriefcase,
  FiChevronDown,
  FiChevronRight,
  FiFileText,
  FiFolder,
  FiGrid,
  FiHelpCircle,
  FiLayers,
  FiLogOut,
  FiMenu,
  FiShoppingBag,
  FiUserCheck,
  FiUsers,
} from 'react-icons/fi';
import logo from '../../assets/logo.png';

const STORAGE_KEY = 'dashboard_sidebar_collapsed';

const navItems = [
  { label: 'User Management', short: 'UM', path: '/dashboard/user-management', icon: FiUsers },
  { label: 'Members Management', short: 'MB', path: '/dashboard/members-management', icon: FiUserCheck },
  { label: 'Trainer Management', short: 'TR', path: '/dashboard/trainer-management', icon: FiBriefcase },
  { label: 'Course Management', short: 'CR', path: '/dashboard/course-management', icon: FiBookOpen },
  { label: 'Sell It Snacks', short: 'SS', path: '/dashboard/sell-it-snacks-management', icon: FiShoppingBag },
  { label: 'Workshop Management', short: 'WS', path: '/dashboard/workshop-management', icon: FiGrid },
  { label: 'Feed Management', short: 'FD', path: '/dashboard/feed-management', icon: FiLayers },
  { label: 'FAQs Management', short: 'FQ', path: '/dashboard/faqs-management', icon: FiHelpCircle },
  { label: 'News Management', short: 'NW', path: '/dashboard/news-management', icon: FiFileText },
  { label: 'Partner Management', short: 'PR', path: '/dashboard/partner-management', icon: FiBriefcase },
  { label: 'Document Center', short: 'DC', path: '/dashboard/document-center-management', icon: FiFolder },
];

const feedManagementLinks = [
  { label: 'Recently Feed', path: '/dashboard/feed-management/recent' },
  { label: 'Reports', path: '/dashboard/feed-management/reports' },
  { label: 'Feed By Members', path: '/dashboard/feed-management/members' },
  { label: 'Wall of Wins', path: '/dashboard/feed-management/wall-of-wins' },
];

function SidebarLinkLabel({ icon: Icon, label, short, collapsed }) {
  return (
    <>
      <span className="lms-nav-icon-wrap" aria-hidden="true">
        <Icon className="lms-nav-icon" />
      </span>
      {collapsed ? <span className="lms-nav-short">{short}</span> : <span>{label}</span>}
    </>
  );
}

export default function DashboardSectionPage({ title, children }) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) === '1' : false,
  );
  const [courseMenuOpen, setCourseMenuOpen] = useState(false);
  const [feedMenuOpen, setFeedMenuOpen] = useState(false);
  const activeCourseTypeParam = new URLSearchParams(search).get('type') || '';
  const isCourseRouteActive = pathname.startsWith('/dashboard/course-management');
  const isFeedRouteActive = pathname.startsWith('/dashboard/feed-management');
  const showCourseMenu = courseMenuOpen || isCourseRouteActive;
  const showFeedMenu = feedMenuOpen || isFeedRouteActive;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  const linkIsActive = (path) => {
    if (path === '/dashboard/user-management') {
      return pathname === path || pathname.startsWith(`${path}/`);
    }
    return pathname === path;
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="d-flex min-vh-100">
      <aside className={`d-none d-lg-flex flex-column text-white lms-bg-purple lms-sidebar ${collapsed ? 'lms-sidebar-collapsed' : ''}`}>
        <div className="lms-sidebar-top">
          <div className={`lms-sidebar-brand ${collapsed ? 'is-collapsed' : ''}`}>
            <div className="lms-sidebar-brand-mark">W</div>
            {!collapsed && (
              <div className="lms-sidebar-brand-copy">
                <img src={logo} alt="Workians" className="lms-sidebar-logo" />
                <span className="lms-sidebar-overline">Admin Workspace</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            className="lms-sidebar-toggle"
            title={collapsed ? 'Expand menu' : 'Minimize menu'}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Minimize sidebar'}
          >
            <FiMenu />
          </button>
        </div>

        {!collapsed && <div className="lms-sidebar-section-label">Navigation</div>}

        <nav className="lms-sidebar-nav">
          {navItems.map((item) => {
            if (item.path === '/dashboard/course-management') {
              if (collapsed) {
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={item.label}
                    className={() => `lms-nav-link lms-nav-link-collapsed ${isCourseRouteActive ? 'active' : ''}`}
                  >
                    <SidebarLinkLabel {...item} collapsed />
                  </NavLink>
                );
              }
              return (
                <div key={item.path} className="lms-nav-group">
                  <button
                    type="button"
                    className={`lms-nav-link lms-nav-link-button ${isCourseRouteActive ? 'active' : ''}`}
                    onClick={() => setCourseMenuOpen((prev) => !prev)}
                    aria-expanded={showCourseMenu}
                  >
                    <span className="lms-nav-link-main">
                      <SidebarLinkLabel {...item} />
                    </span>
                    <span className="lms-nav-chevron" aria-hidden="true">
                      {showCourseMenu ? <FiChevronDown /> : <FiChevronRight />}
                    </span>
                  </button>
                  {showCourseMenu && (
                    <div className="lms-nav-submenu">
                      <Link
                        to="/dashboard/course-management?type=short-courses"
                        className={`lms-nav-sublink ${
                          pathname === '/dashboard/course-management' && activeCourseTypeParam === 'short-courses'
                            ? 'active'
                            : ''
                        }`}
                      >
                        Short Courses
                      </Link>
                      <Link
                        to="/dashboard/course-management?type=chapter-wise-course"
                        className={`lms-nav-sublink ${
                          pathname === '/dashboard/course-management'
                          && (activeCourseTypeParam === 'chapter-wise-topic-wise' || activeCourseTypeParam === 'chapter-wise-course')
                            ? 'active'
                            : ''
                        }`}
                      >
                        Chapter Wise Course
                      </Link>
                    </div>
                  )}
                </div>
              );
            }

            if (item.path === '/dashboard/feed-management') {
              if (collapsed) {
                return (
                  <NavLink
                    key={item.path}
                    to="/dashboard/feed-management/recent"
                    title={item.label}
                    className={() => `lms-nav-link lms-nav-link-collapsed ${isFeedRouteActive ? 'active' : ''}`}
                  >
                    <SidebarLinkLabel {...item} collapsed />
                  </NavLink>
                );
              }
              return (
                <div key={item.path} className="lms-nav-group">
                  <button
                    type="button"
                    className={`lms-nav-link lms-nav-link-button ${isFeedRouteActive ? 'active' : ''}`}
                    onClick={() => setFeedMenuOpen((prev) => !prev)}
                    aria-expanded={showFeedMenu}
                  >
                    <span className="lms-nav-link-main">
                      <SidebarLinkLabel {...item} />
                    </span>
                    <span className="lms-nav-chevron" aria-hidden="true">
                      {showFeedMenu ? <FiChevronDown /> : <FiChevronRight />}
                    </span>
                  </button>
                  {showFeedMenu && (
                    <div className="lms-nav-submenu">
                      {feedManagementLinks.map((link) => (
                        <Link
                          key={link.path}
                          to={link.path}
                          className={`lms-nav-sublink ${pathname === link.path ? 'active' : ''}`}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
                className={() => `lms-nav-link ${collapsed ? 'lms-nav-link-collapsed' : ''} ${linkIsActive(item.path) ? 'active' : ''}`}
              >
                <SidebarLinkLabel {...item} collapsed={collapsed} />
              </NavLink>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="lms-sidebar-card">
            <span className="lms-sidebar-card-kicker">Control Center</span>
            <strong className="lms-sidebar-card-title">Everything in one place</strong>
            <p className="lms-sidebar-card-copy mb-0">
              Manage users, courses, content, and reports from a cleaner navigation rail.
            </p>
          </div>
        )}

        <div className="lms-sidebar-footer">
          <button
            type="button"
            onClick={handleLogout}
            className={`lms-sidebar-logout ${collapsed ? 'is-collapsed' : ''}`}
            title="Logout"
          >
            <FiLogOut aria-hidden="true" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <main className="flex-grow-1 p-3 p-sm-4">
        {children ? (
          children
        ) : (
          <div className="lms-card p-5 d-flex align-items-center justify-content-center" style={{ minHeight: 220 }}>
            <div className="text-center">
              <h1 className="h3 fw-bold text-dark">{title}</h1>
              <p className="text-muted mb-0">This is the {title} page.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

