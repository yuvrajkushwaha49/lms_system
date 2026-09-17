import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  FiBookOpen,
  FiChevronDown,
  FiChevronRight,
  FiGrid,
  FiHome,
  FiLayers,
  FiLogOut,
  FiMenu,
  FiMessageSquare,
  FiSearch,
  FiShoppingBag,
  FiTag,
  FiUsers,
} from 'react-icons/fi';
import logo from '../../assets/logo.png';

const STORAGE_KEY = 'trainer_dashboard_sidebar_collapsed';

const trainerWelcomeNavItems = [
  { label: 'Start Here', icon: '🆕', short: 'Start', path: '/dashboard/trainer-start-here' },
  { label: 'Meet + Greet', icon: '👋', short: 'Meet', path: '/dashboard/trainer-meet-greet' },
  { label: 'Ask Ryan Anything', icon: 's.', short: 'Ask', path: '/dashboard/trainer-ask-ryan' },
  { label: 'Owning Manhattan', icon: '🏙', short: 'Owning', path: '/dashboard/trainer-owning-manhattan' },
  { label: 'Community Input', icon: '✏️', short: 'Input', path: '/dashboard/trainer-feed' },
];

const trainerNavItems = [
  { label: 'Dashboard', short: 'Home', path: '/dashboard/trainer-dashboard', icon: FiGrid },
  { label: 'Course', short: 'Course', path: '/dashboard/trainer-course', icon: FiBookOpen },
  { label: 'Sell It Snacks', short: 'Snacks', path: '/dashboard/trainer-sell-it-snacks', icon: FiShoppingBag },
  { label: 'News', short: 'News', path: '/dashboard/trainer-news', icon: FiTag },
  { label: 'Search', short: 'Search', path: '/dashboard/trainer-search', icon: FiSearch },
  { label: 'Partners', short: 'Partners', path: '/dashboard/trainer-partners', icon: FiUsers },
  { label: 'Chat Support', short: 'Chat', path: '/dashboard/trainer-chat-support', icon: FiMessageSquare },
  { label: 'Feed', short: 'Feed', path: '/dashboard/trainer-feed', icon: FiLayers },
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

export default function TrainerDashboardSectionPage({ title, children }) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) === '1' : false,
  );
  const [welcomeMenuOpen, setWelcomeMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  const isTrainerOwningManhattanDetail =
    pathname.startsWith('/dashboard/trainer-course/') &&
    new URLSearchParams(search).get('from') === 'owning-manhattan';

  const linkIsActive = (path) => {
    if (path === '/dashboard/trainer-owning-manhattan' && isTrainerOwningManhattanDetail) return true;
    if (path === '/dashboard/trainer-course' && isTrainerOwningManhattanDetail) return false;
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const isWelcomeRouteActive = trainerWelcomeNavItems.some((item) => linkIsActive(item.path));
  const showWelcomeMenu = welcomeMenuOpen || isWelcomeRouteActive;

  useEffect(() => {
    if (isWelcomeRouteActive) setWelcomeMenuOpen(true);
  }, [isWelcomeRouteActive]);

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

        <div className={`student-starter-panel ${collapsed ? 'collapsed' : ''}`}>
          <button
            type="button"
            className={`student-starter-panel-head ${isWelcomeRouteActive ? 'active' : ''} ${collapsed ? 'lms-nav-link-collapsed collapsed' : ''}`}
            onClick={() => setWelcomeMenuOpen((prev) => !prev)}
            title="Welcome"
            aria-expanded={showWelcomeMenu}
          >
            {collapsed ? (
              <>
                <span className="lms-nav-icon-wrap" aria-hidden="true">
                  <FiHome className="lms-nav-icon" />
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
              {trainerWelcomeNavItems.map((item) => (
                <NavLink
                  key={`trainer-welcome-${item.path}`}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  className={`student-starter-panel-link ${collapsed ? 'is-collapsed-rail' : ''} ${linkIsActive(item.path) ? 'active' : ''}`}
                >
                  <span className="student-starter-panel-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  {collapsed ? (
                    <span className="lms-nav-underlabel">{item.short || item.label}</span>
                  ) : (
                    <>
                      <span className="student-starter-panel-label">{item.label}</span>
                      {item.label === 'Start Here' && <span className="student-starter-panel-badge">NEW</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        <nav className="lms-sidebar-nav">
          {trainerNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={() => `lms-nav-link ${collapsed ? 'lms-nav-link-collapsed' : ''} ${linkIsActive(item.path) ? 'active' : ''}`}
            >
              <SidebarLinkLabel {...item} collapsed={collapsed} />
            </NavLink>
          ))}
        </nav>

        {!collapsed && (
          <div className="lms-sidebar-card">
            <span className="lms-sidebar-card-kicker">Trainer Flow</span>
            <strong className="lms-sidebar-card-title">Keep lessons moving</strong>
            <p className="lms-sidebar-card-copy mb-0">
              Review course content, answer support messages, and track feed activity from one panel.
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

      <main className={`flex-grow-1 p-3 p-sm-4${collapsed ? ' is-sidebar-collapsed' : ''}`}>
        {children || (
          <div className="lms-card p-5 d-flex align-items-center justify-content-center" style={{ minHeight: 220 }}>
            <div className="text-center">
              <h1 className="h3 fw-bold text-dark">{title || 'Trainer Dashboard'}</h1>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
