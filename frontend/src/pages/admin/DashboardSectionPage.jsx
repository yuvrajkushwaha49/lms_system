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
  FiImage,
  FiLayers,
  FiLogOut,
  FiMenu,
  FiMessageCircle,
  FiSettings,
  FiUserCheck,
  FiUsers,
} from 'react-icons/fi';
import logo from '../../assets/logo.png';
import LearningCenterSidebarSection from '../../components/LearningCenterSidebarSection';

const STORAGE_KEY = 'dashboard_sidebar_collapsed';

const navItems = [
  { label: 'User Management', short: 'Users', path: '/dashboard/user-management', icon: FiUsers },
  { label: 'Members Management', short: 'Members', path: '/dashboard/members-management', icon: FiUserCheck },
  { label: 'Trainer Management', short: 'Trainers', path: '/dashboard/trainer-management', icon: FiBriefcase },
  { label: 'Monthly Challenges', short: 'Monthly', path: '/dashboard/monthly-challenges-management', icon: FiCalendar },
  { label: 'Workshop Management', short: 'Workshops', path: '/dashboard/workshop-management', icon: FiGrid },
  { label: 'Gallery Management', short: 'Gallery', path: '/dashboard/gallery-management', icon: FiImage },
  { label: 'Community', short: 'Community', path: '/dashboard/admin-community', icon: FiMessageCircle },
  { label: 'Feed Management', short: 'Feed', path: '/dashboard/feed-management', icon: FiLayers },
  { label: 'FAQs Management', short: 'FAQs', path: '/dashboard/faqs-management', icon: FiHelpCircle },
  { label: 'Student Navbar', short: 'Navbar', path: '/dashboard/student-nav-visibility', icon: FiSettings },
  { label: 'News Management', short: 'News', path: '/dashboard/news-management', icon: FiFileText },
  { label: 'Partner Management', short: 'Partners', path: '/dashboard/partner-management', icon: FiBriefcase },
];

const communityAdminLinks = [
  {
    type: 'group',
    key: 'sell-it-community',
    label: 'Sell It Community',
    children: [
      { label: 'Recently Sell It Community', short: 'Recent', path: '/dashboard/admin-community/recent' },
      { label: 'Reports', short: 'Reports', path: '/dashboard/admin-community/reports' },
    ],
  },
  { type: 'link', label: 'Referral Partners', short: 'Referral', path: '/dashboard/admin-community/referral-partners' },
  { type: 'link', label: 'Community Listings', short: 'Listings', path: '/dashboard/admin-community/listings' },
];

const feedManagementLinks = [
  { label: 'Recently Feed', short: 'Recent', path: '/dashboard/feed-management/recent' },
  { label: 'Reports', short: 'Reports', path: '/dashboard/feed-management/reports' },
  { label: 'Feed By Members', short: 'Members', path: '/dashboard/feed-management/members' },
  { label: 'Wall of Wins', short: 'Wins', path: '/dashboard/feed-management/wall-of-wins' },
  { label: 'Upcoming Events', short: 'Events', path: '/dashboard/feed-management/upcoming-events' },
];

const welcomeAdminLinks = [
  { label: 'Start Here', short: 'Start', path: '/dashboard/welcome-admin/start-here' },
  { label: 'Meet + Greet', short: 'Meet', path: '/dashboard/welcome-admin/meet-greet' },
  { label: 'Ask Ryan Anything', short: 'Ask', path: '/dashboard/welcome-admin/ask-ryan' },
  { label: 'Owning Manhattan', short: 'Owning', path: '/dashboard/course-management?type=owning-manhattan' },
  { label: 'Community Input', short: 'Input', path: '/dashboard/admin-community/recent' },
];

function SidebarLinkLabel({ icon: Icon, label, short, collapsed }) {
  return (
    <>
      <span className="lms-nav-icon-wrap" aria-hidden="true">
        <Icon className="lms-nav-icon" />
      </span>
      {collapsed ? (
        <span className="lms-nav-underlabel">{short || label}</span>
      ) : (
        <span>{label}</span>
      )}
    </>
  );
}

function flattenCommunityLinks(entries) {
  const out = [];
  entries.forEach((entry) => {
    if (entry.type === 'group' && entry.children) {
      entry.children.forEach((child) => out.push(child));
    } else if (entry.type === 'link') {
      out.push(entry);
    }
  });
  return out;
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
  const communityFlatLinks = flattenCommunityLinks(communityAdminLinks);

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
    if (path === '/dashboard/user-management' || path === '/dashboard/gallery-management') {
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
            <img src={logo} alt="Workians" className="lms-sidebar-logo" />
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

        <nav className="lms-sidebar-nav">
          <div className={`student-starter-panel ${collapsed ? 'collapsed' : ''}`}>
            <button
              type="button"
              className={`student-starter-panel-head ${isWelcomeAdminRouteActive ? 'active' : ''} ${collapsed ? 'lms-nav-link-collapsed collapsed' : ''}`}
              onClick={() => setWelcomeMenuOpen((prev) => !prev)}
              title="Welcome"
              aria-expanded={showWelcomeMenu}
            >
              {collapsed ? (
                <>
                  <span className="lms-nav-icon-wrap" aria-hidden="true">
                    <FiHeart className="lms-nav-icon" />
                  </span>
                  <span className="lms-nav-underlabel">Welcome</span>
                  <span className="student-starter-panel-more is-collapsed-chevron" aria-hidden="true">
                    {showWelcomeMenu ? <FiChevronDown /> : <FiChevronRight />}
                  </span>
                </>
              ) : (
                <>
                  <span className="student-starter-panel-title">Welcome!</span>
                  <span className="student-starter-panel-more" aria-hidden="true">
                    {showWelcomeMenu ? <FiChevronDown /> : <FiChevronRight />}
                  </span>
                </>
              )}
            </button>
            {showWelcomeMenu && (
              <div className={`student-starter-panel-list ${collapsed ? 'is-collapsed-rail' : ''}`}>
                {welcomeAdminLinks.map((link) => {
                  const omWelcomeActive =
                    link.path.includes('type=owning-manhattan') && isOwningManhattanCourseAdmin;
                  const welcomeActive = welcomeLinkIsActive(link.path) || omWelcomeActive;
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      title={collapsed ? link.label : undefined}
                      className={`student-starter-panel-link ${collapsed ? 'is-collapsed-rail' : ''} ${welcomeActive ? 'active' : ''}`}
                    >
                      {collapsed ? (
                        <span className="lms-nav-underlabel">{link.short || link.label}</span>
                      ) : (
                        <span className="student-starter-panel-label">{link.label}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <LearningCenterSidebarSection variant="admin" collapsed={collapsed} />

          {navItems.map((item) => {
            if (item.path === '/dashboard/admin-community') {
              return (
                <div key={item.path} className={`student-starter-panel ${collapsed ? 'collapsed' : ''}`}>
                  <button
                    type="button"
                    className={`student-starter-panel-head ${isCommunityAdminRouteActive ? 'active' : ''} ${collapsed ? 'lms-nav-link-collapsed collapsed' : ''}`}
                    onClick={() => setCommunityMenuOpen((prev) => !prev)}
                    title={item.label}
                    aria-expanded={showCommunityMenu}
                  >
                    {collapsed ? (
                      <>
                        <span className="lms-nav-icon-wrap" aria-hidden="true">
                          <item.icon className="lms-nav-icon" />
                        </span>
                        <span className="lms-nav-underlabel">{item.short}</span>
                        <span className="student-starter-panel-more is-collapsed-chevron" aria-hidden="true">
                          {showCommunityMenu ? <FiChevronDown /> : <FiChevronRight />}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="student-starter-panel-title">{item.label}</span>
                        <span className="student-starter-panel-more" aria-hidden="true">
                          {showCommunityMenu ? <FiChevronDown /> : <FiChevronRight />}
                        </span>
                      </>
                    )}
                  </button>
                  {showCommunityMenu && (
                    <div className={`student-starter-panel-list ${collapsed ? 'is-collapsed-rail' : ''}`}>
                      {collapsed
                        ? communityFlatLinks.map((link) => (
                            <Link
                              key={link.path}
                              to={link.path}
                              title={link.label}
                              className={`student-starter-panel-link is-collapsed-rail ${communityChildIsActive(link.path) || pathname === link.path ? 'active' : ''}`}
                            >
                              <span className="lms-nav-underlabel">{link.short || link.label}</span>
                            </Link>
                          ))
                        : communityAdminLinks.map((entry) => {
                            if (entry.type === 'group' && entry.children) {
                              return (
                                <div key={entry.key} className="lms-nav-submenu-group">
                                  <div className="lms-nav-submenu-label">{entry.label}</div>
                                  {entry.children.map((child) => (
                                    <Link
                                      key={child.path}
                                      to={child.path}
                                      className={`student-starter-panel-link ${
                                        communityChildIsActive(child.path) ? 'active' : ''
                                      }`}
                                    >
                                      <span className="student-starter-panel-label">{child.label}</span>
                                    </Link>
                                  ))}
                                </div>
                              );
                            }
                            return (
                              <Link
                                key={entry.path}
                                to={entry.path}
                                className={`student-starter-panel-link ${pathname === entry.path ? 'active' : ''}`}
                              >
                                <span className="student-starter-panel-label">{entry.label}</span>
                              </Link>
                            );
                          })}
                    </div>
                  )}
                </div>
              );
            }

            if (item.path === '/dashboard/feed-management') {
              return (
                <div key={item.path} className={`student-starter-panel ${collapsed ? 'collapsed' : ''}`}>
                  <button
                    type="button"
                    className={`student-starter-panel-head ${isFeedRouteActive ? 'active' : ''} ${collapsed ? 'lms-nav-link-collapsed collapsed' : ''}`}
                    onClick={() => setFeedMenuOpen((prev) => !prev)}
                    title={item.label}
                    aria-expanded={showFeedMenu}
                  >
                    {collapsed ? (
                      <>
                        <span className="lms-nav-icon-wrap" aria-hidden="true">
                          <item.icon className="lms-nav-icon" />
                        </span>
                        <span className="lms-nav-underlabel">{item.short}</span>
                        <span className="student-starter-panel-more is-collapsed-chevron" aria-hidden="true">
                          {showFeedMenu ? <FiChevronDown /> : <FiChevronRight />}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="student-starter-panel-title">{item.label}</span>
                        <span className="student-starter-panel-more" aria-hidden="true">
                          {showFeedMenu ? <FiChevronDown /> : <FiChevronRight />}
                        </span>
                      </>
                    )}
                  </button>
                  {showFeedMenu && (
                    <div className={`student-starter-panel-list ${collapsed ? 'is-collapsed-rail' : ''}`}>
                      {feedManagementLinks.map((link) => (
                        <Link
                          key={link.path}
                          to={link.path}
                          title={collapsed ? link.label : undefined}
                          className={`student-starter-panel-link ${collapsed ? 'is-collapsed-rail' : ''} ${pathname === link.path ? 'active' : ''}`}
                        >
                          {collapsed ? (
                            <span className="lms-nav-underlabel">{link.short || link.label}</span>
                          ) : (
                            <span className="student-starter-panel-label">{link.label}</span>
                          )}
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
            <span className={collapsed ? 'lms-nav-underlabel' : undefined}>Logout</span>
          </button>
        </div>
      </aside>

      <main className={`flex-grow-1 p-3 p-sm-4 marg-20${collapsed ? ' is-sidebar-collapsed' : ''}`}>
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
