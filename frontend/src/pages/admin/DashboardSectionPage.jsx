import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  FiBriefcase,
  FiCalendar,
  FiChevronDown,
  FiChevronRight,
  FiFileText,
  FiGrid,
  FiHeart,
  FiHelpCircle,
  FiLayers,
  FiLogOut,
  FiMenu,
  FiMessageCircle,
  FiUserCheck,
  FiUsers,
} from 'react-icons/fi';
import logo from '../../assets/logo.png';
import LearningCenterSidebarSection from '../../components/LearningCenterSidebarSection';

const STORAGE_KEY = 'dashboard_sidebar_collapsed';

const navItems = [
  { label: 'User Management', short: 'UM', path: '/dashboard/user-management', icon: FiUsers },
  { label: 'Members Management', short: 'MB', path: '/dashboard/members-management', icon: FiUserCheck },
  { label: 'Trainer Management', short: 'TR', path: '/dashboard/trainer-management', icon: FiBriefcase },
  { label: 'Monthly Challenges', short: 'MC', path: '/dashboard/monthly-challenges-management', icon: FiCalendar },
  { label: 'Workshop Management', short: 'WS', path: '/dashboard/workshop-management', icon: FiGrid },
  { label: 'Community', short: 'CM', path: '/dashboard/admin-community', icon: FiMessageCircle },
  { label: 'Feed Management', short: 'FD', path: '/dashboard/feed-management', icon: FiLayers },
  { label: 'FAQs Management', short: 'FQ', path: '/dashboard/faqs-management', icon: FiHelpCircle },
  { label: 'News Management', short: 'NW', path: '/dashboard/news-management', icon: FiFileText },
  { label: 'Partner Management', short: 'PR', path: '/dashboard/partner-management', icon: FiBriefcase },
];

const communityAdminLinks = [
  {
    type: 'group',
    key: 'sell-it-community',
    label: 'Sell It Community',
    children: [
      { label: 'Recently Sell It Community', path: '/dashboard/admin-community/recent' },
      { label: 'Reports', path: '/dashboard/admin-community/reports' },
    ],
  },
  { type: 'link', label: 'Referral Partners', path: '/dashboard/admin-community/referral-partners' },
  { type: 'link', label: 'Community Listings', path: '/dashboard/admin-community/listings' },
];

const feedManagementLinks = [
  { label: 'Recently Feed', path: '/dashboard/feed-management/recent' },
  { label: 'Reports', path: '/dashboard/feed-management/reports' },
  { label: 'Feed By Members', path: '/dashboard/feed-management/members' },
  { label: 'Wall of Wins', path: '/dashboard/feed-management/wall-of-wins' },
];

const welcomeAdminLinks = [
  { label: 'Start Here', path: '/dashboard/welcome-admin/start-here' },
  { label: 'Meet + Greet', path: '/dashboard/welcome-admin/meet-greet' },
  { label: 'Ask Ryan Anything', path: '/dashboard/welcome-admin/ask-ryan' },
  { label: 'Owning Manhattan', path: '/dashboard/course-management?type=owning-manhattan' },
  { label: 'Community Input', path: '/dashboard/admin-community/recent' },
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
  const { pathname, search, state } = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) === '1' : false,
  );
  const [feedMenuOpen, setFeedMenuOpen] = useState(false);
  const [communityMenuOpen, setCommunityMenuOpen] = useState(false);
  const [welcomeMenuOpen, setWelcomeMenuOpen] = useState(false);
  const activeCourseTypeParam = new URLSearchParams(search).get('type') || '';
  const omAdminReturnPath =
    typeof state === 'object' && state != null && state.omAdminReturnPath != null
      ? String(state.omAdminReturnPath)
      : '';
  const isOwningManhattanAdminVideoRoute =
    /^\/dashboard\/course-management\/[^/]+\/videos\/[^/]+$/.test(pathname) &&
    (omAdminReturnPath.includes('type=owning-manhattan') ||
      omAdminReturnPath.startsWith('/dashboard/owning-manhattan/'));
  const isOwningManhattanCourseCatalog =
    pathname.startsWith('/dashboard/course-management') && activeCourseTypeParam === 'owning-manhattan';
  const isOwningManhattanDetailAdmin = pathname.startsWith('/dashboard/owning-manhattan/');
  const isOwningManhattanCourseAdmin =
    isOwningManhattanCourseCatalog ||
    isOwningManhattanDetailAdmin ||
    isOwningManhattanAdminVideoRoute;
  const isWelcomeAdminRouteActive =
    pathname.startsWith('/dashboard/welcome-video-management') ||
    pathname.startsWith('/dashboard/welcome-admin') ||
    isOwningManhattanCourseAdmin;

  const welcomeLinkIsActive = (toPath) => {
    const [path, queryPart] = toPath.split('?');
    if (path === '/dashboard/admin-community/recent' && pathname.startsWith('/dashboard/admin-community')) {
      return true;
    }
    if (pathname !== path) return false;
    if (!queryPart) return true;
    const needed = new URLSearchParams(queryPart);
    const current = new URLSearchParams(search);
    for (const [key, value] of needed) {
      if (current.get(key) !== value) return false;
    }
    return true;
  };
  const isCommunityAdminRouteActive = pathname.startsWith('/dashboard/admin-community');
  const isFeedRouteActive = pathname.startsWith('/dashboard/feed-management');
  const showCommunityMenu = communityMenuOpen || isCommunityAdminRouteActive;
  const showFeedMenu = feedMenuOpen || isFeedRouteActive;
  const showWelcomeMenu = welcomeMenuOpen || isWelcomeAdminRouteActive;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    if (isWelcomeAdminRouteActive) setWelcomeMenuOpen(true);
  }, [isWelcomeAdminRouteActive]);

  useEffect(() => {
    if (isCommunityAdminRouteActive) setCommunityMenuOpen(true);
  }, [isCommunityAdminRouteActive]);

  const communityChildIsActive = (childPath) => {
    if (childPath === '/dashboard/admin-community/reports') {
      return (
        pathname === childPath ||
        /^\/dashboard\/admin-community\/reports\/[^/]+$/.test(pathname)
      );
    }
    return pathname === childPath;
  };

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
          {collapsed ? (
            <NavLink
              to="/dashboard/welcome-admin/start-here"
              title="Welcome"
              className={() => `lms-nav-link lms-nav-link-collapsed ${isWelcomeAdminRouteActive ? 'active' : ''}`}
            >
              <span className="lms-nav-icon-wrap" aria-hidden="true">
                <FiHeart className="lms-nav-icon" />
              </span>
              <span className="lms-nav-short">W</span>
            </NavLink>
          ) : (
            <div className="lms-nav-group">
              <button
                type="button"
                className={`lms-nav-link lms-nav-link-button ${isWelcomeAdminRouteActive ? 'active' : ''}`}
                onClick={() => setWelcomeMenuOpen((prev) => !prev)}
                aria-expanded={showWelcomeMenu}
              >
                <span className="lms-nav-link-main">
                  <span className="lms-nav-icon-wrap" aria-hidden="true">
                    <FiHeart className="lms-nav-icon" />
                  </span>
                  <span>Welcome!</span>
                </span>
                <span className="lms-nav-chevron" aria-hidden="true">
                  {showWelcomeMenu ? <FiChevronDown /> : <FiChevronRight />}
                </span>
              </button>
              {showWelcomeMenu && (
                <div className="lms-nav-submenu">
                  {welcomeAdminLinks.map((link) => {
                    const omWelcomeActive =
                      link.path.includes('type=owning-manhattan') && isOwningManhattanCourseAdmin;
                    const welcomeActive = welcomeLinkIsActive(link.path) || omWelcomeActive;
                    return (
                      <Link
                        key={link.path}
                        to={link.path}
                        className={`lms-nav-sublink ${welcomeActive ? 'active' : ''}`}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <LearningCenterSidebarSection variant="admin" collapsed={collapsed} />
          {navItems.map((item) => {
            if (item.path === '/dashboard/admin-community') {
              if (collapsed) {
                return (
                  <NavLink
                    key={item.path}
                    to="/dashboard/admin-community/recent"
                    title={item.label}
                    className={() =>
                      `lms-nav-link lms-nav-link-collapsed ${isCommunityAdminRouteActive ? 'active' : ''}`
                    }
                  >
                    <SidebarLinkLabel {...item} collapsed />
                  </NavLink>
                );
              }
              return (
                <div key={item.path} className="lms-nav-group">
                  <button
                    type="button"
                    className={`lms-nav-link lms-nav-link-button ${isCommunityAdminRouteActive ? 'active' : ''}`}
                    onClick={() => setCommunityMenuOpen((prev) => !prev)}
                    aria-expanded={showCommunityMenu}
                  >
                    <span className="lms-nav-link-main">
                      <SidebarLinkLabel {...item} />
                    </span>
                    <span className="lms-nav-chevron" aria-hidden="true">
                      {showCommunityMenu ? <FiChevronDown /> : <FiChevronRight />}
                    </span>
                  </button>
                  {showCommunityMenu && (
                    <div className="lms-nav-submenu">
                      {communityAdminLinks.map((entry) => {
                        if (entry.type === 'group' && entry.children) {
                          return (
                            <div key={entry.key} className="lms-nav-submenu-group">
                              <div className="lms-nav-submenu-label">{entry.label}</div>
                              {entry.children.map((child) => (
                                <Link
                                  key={child.path}
                                  to={child.path}
                                  className={`lms-nav-sublink lms-nav-sublink-nested ${
                                    communityChildIsActive(child.path) ? 'active' : ''
                                  }`}
                                >
                                  {child.label}
                                </Link>
                              ))}
                            </div>
                          );
                        }
                        return (
                          <Link
                            key={entry.path}
                            to={entry.path}
                            className={`lms-nav-sublink ${pathname === entry.path ? 'active' : ''}`}
                          >
                            {entry.label}
                          </Link>
                        );
                      })}
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

      <main className="flex-grow-1 p-3 p-sm-4 marg-20">
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

