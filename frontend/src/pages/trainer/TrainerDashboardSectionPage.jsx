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
  { label: 'Start Here', icon: '🆕', short: 'SH', path: '/dashboard/trainer-start-here' },
  { label: 'Meet + Greet', icon: '👋', short: 'MG', path: '/dashboard/trainer-meet-greet' },
  { label: 'Ask Ryan Anything', icon: 's.', short: 'AR', path: '/dashboard/trainer-ask-ryan' },
  { label: 'Owning Manhattan', icon: '🏙', short: 'OM', path: '/dashboard/trainer-owning-manhattan' },
  { label: 'Community Input', icon: '✏️', short: 'CI', path: '/dashboard/trainer-feed' },
];

const trainerNavItems = [
  { label: 'Dashboard', short: 'DB', path: '/dashboard/trainer-dashboard', icon: FiGrid },
  { label: 'Course', short: 'CR', path: '/dashboard/trainer-course', icon: FiBookOpen },
  { label: 'Sell It Snacks', short: 'SS', path: '/dashboard/trainer-sell-it-snacks', icon: FiShoppingBag },
  { label: 'News', short: 'NW', path: '/dashboard/trainer-news', icon: FiTag },
  { label: 'Search', short: 'SR', path: '/dashboard/trainer-search', icon: FiSearch },
  { label: 'Partners', short: 'PT', path: '/dashboard/trainer-partners', icon: FiUsers },
  { label: 'Chat Support', short: 'CS', path: '/dashboard/trainer-chat-support', icon: FiMessageSquare },
  { label: 'Feed', short: 'FD', path: '/dashboard/trainer-feed', icon: FiLayers },
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
            <div className="lms-sidebar-brand-mark">W</div>
            {!collapsed && (
              <div className="lms-sidebar-brand-copy">
                <img src={logo} alt="Workians" className="lms-sidebar-logo" />
                <span className="lms-sidebar-overline">Trainer Desk</span>
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

        {!collapsed && <div className="lms-sidebar-section-label">Teaching Tools</div>}

        <div className={`student-starter-panel ${collapsed ? 'collapsed' : ''}`}>
          {collapsed ? (
            <NavLink
              to="/dashboard/trainer-start-here"
              title="Welcome"
              className={`lms-nav-link lms-nav-link-collapsed ${isWelcomeRouteActive ? 'active' : ''}`}
            >
              <span className="lms-nav-icon-wrap" aria-hidden="true">
                <FiHome className="lms-nav-icon" />
              </span>
              <span className="lms-nav-short">W</span>
            </NavLink>
          ) : (
            <>
              <button
                type="button"
                className="student-starter-panel-head"
                onClick={() => setWelcomeMenuOpen((prev) => !prev)}
                aria-expanded={showWelcomeMenu}
              >
                <span className="student-starter-panel-title">Welcome!</span>
                <span className="student-starter-panel-more" aria-hidden="true">
                  {showWelcomeMenu ? <FiChevronDown /> : <FiChevronRight />}
                </span>
              </button>
              {showWelcomeMenu && (
                <div className="student-starter-panel-list">
                  {trainerWelcomeNavItems.map((item) => (
                    <NavLink
                      key={`trainer-welcome-${item.path}`}
                      to={item.path}
                      className={`student-starter-panel-link ${linkIsActive(item.path) ? 'active' : ''}`}
                    >
                      <span className="student-starter-panel-icon" aria-hidden="true">
                        {item.icon}
                      </span>
                      <span className="student-starter-panel-label">{item.label}</span>
                      {item.label === 'Start Here' && <span className="student-starter-panel-badge">NEW</span>}
                    </NavLink>
                  ))}
                </div>
              )}
            </>
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
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <main className="flex-grow-1 p-3 p-sm-4">
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

