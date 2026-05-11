import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import logo from "../../assets/logo.png";
import {
  FiAward,
  FiBell,
  FiBookmark,
  FiBriefcase,
  FiChevronDown,
  FiChevronRight,
  FiCompass,
  FiFileText,
  FiGrid,
  FiHelpCircle,
  FiHome,
  FiImage,
  FiLogOut,
  FiMenu,
  FiMessageCircle,
  FiMessageSquare,
  FiShoppingBag,
  FiUser,
  FiVideo,
} from "react-icons/fi";
const STORAGE_KEY = "student_dashboard_sidebar_collapsed";

const feedNavItem = { label: "Feed", short: "FD", path: "/dashboard/student-community", icon: FiCompass };

const studentNavItems = [
  // { label: "Dashboard", short: "DB", path: "/dashboard/student-dashboard" },
  // { label: "My Courses", short: "CR", path: "/dashboard/student-course" },
  { label: "Workshops", short: "WS", path: "/dashboard/student-workshops", icon: FiVideo },
  { label: "Gallery", short: "GL", path: "/dashboard/student-gallery", icon: FiImage },
  { label: "Messages", short: "MS", path: "/dashboard/student-message", icon: FiMessageSquare },
  { label: "Bookmarks", short: "BM", path: "/dashboard/student-bookmarks", icon: FiBookmark },
  {
    label: "Document Center",
    short: "DC",
    path: "/dashboard/student-document-center",
    icon: FiFileText,
  },
];

const starterNavItems = [
  { label: "Start Here", icon: "🆕", short: "SH", path: "/dashboard/student-start-here" },
  { label: "Live Workshops", icon: "🎬", short: "LW", path: "/dashboard/student-live-workshops" },
  { label: "Sell It Snacks", icon: "🍿", short: "SS", path: "/dashboard/student-sell-it-snacks" },
  { label: "Wall of Wins", icon: "🏆", short: "WW", path: "/dashboard/student-wall-of-wins" },
  { label: "FAQs", icon: "❓", short: "FAQ", path: "/dashboard/student-faqs" },
];

const topHeaderLinks = [
  { key: "home", label: "Home", path: "/dashboard/student-dashboard" },
  { key: "courses", label: "Courses", path: "/dashboard/student-course" },
  { key: "events", label: "Events", path: "/dashboard/student-workshops" },
  {
    key: "leaderboard",
    label: "Leaderboard",
    path: "/dashboard/student-community",
  },
];

export default function StudentDashboardSectionPage({
  title,
  children,
  topHeaderSearchValue,
  onTopHeaderSearchChange,
  bookmarkLessons = [],
  onRemoveBookmarkLesson,
  bookmarkMediaFiles = [],
  onRemoveBookmarkMedia,
}) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem(STORAGE_KEY) === "1"
      : false,
  );
  const [showBookmarkPanel, setShowBookmarkPanel] = useState(false);
  const [activeBookmarkTab, setActiveBookmarkTab] = useState("posts");
  const [showMessagePanel, setShowMessagePanel] = useState(false);
  const [activeMessageTab, setActiveMessageTab] = useState("inbox");
  const [starterMenuOpen, setStarterMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const isStartHereCourseDetail = pathname.startsWith("/dashboard/student-course/") && new URLSearchParams(search).get("from") === "start-here";
  const linkIsActive = (path) => {
    if (path === "/dashboard/student-start-here" && isStartHereCourseDetail) return true;
    if (path === "/dashboard/student-course" && isStartHereCourseDetail) return false;
    return pathname === path || pathname.startsWith(`${path}/`);
  };
  const isStarterRouteActive = starterNavItems.some((item) => linkIsActive(item.path));
  const showStarterMenu = starterMenuOpen;
  const activeTopHeaderKey = pathname.startsWith("/dashboard/student-course")
    ? "courses"
    : pathname.startsWith("/dashboard/student-workshops")
      ? "events"
      : pathname.startsWith("/dashboard/student-community")
        ? "leaderboard"
        : "home";
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userInitial =
    String(user?.name || "S")
      .trim()
      .charAt(0)
      .toUpperCase() || "S";

  useEffect(() => {
    if (isStarterRouteActive) {
      setStarterMenuOpen(true);
    }
  }, [isStarterRouteActive]);

  const SidebarLinkLabel = ({ icon: Icon, label, short, collapsed: isCollapsed }) => (
    <>
      <span className="lms-nav-icon-wrap" aria-hidden="true">
        <Icon className="lms-nav-icon" />
      </span>
      {isCollapsed ? <span className="lms-nav-short">{short}</span> : <span>{label}</span>}
    </>
  );

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const bookmarkTabs = [
    { key: "posts", label: "Posts" },
    { key: "comments", label: "Comments" },
    { key: "events", label: "Events" },
    { key: "lessons", label: "Lessons" },
    { key: "media", label: "Media Files" },
    { key: "messages", label: "Messages" },
  ];
  const messageTabs = [
    { key: "inbox", label: "Inbox" },
    { key: "unread", label: "Unread" },
    { key: "agents", label: "Agents" },
  ];
  const messageItems = [
    {
      id: "m1",
      name: "Sell It Concierge",
      date: "Mar 25",
      text: "Hello and welcome to the membership! ...",
      highlighted: true,
    },
    {
      id: "m2",
      name: "Kyle Bone",
      date: "Mar 27",
      text: "Hi, you're a few days in, right about when...",
    },
    {
      id: "m3",
      name: "Jade Shenker",
      date: "Dec 5, 2025",
      text: "i will surely see i love ryan serhant",
    },
    {
      id: "m4",
      name: "Drew Appelbaum",
      date: "Oct 6, 2025",
      text: "Hey, Let's goooooooo (yes, I'm...",
    },
  ];

  return (
    <div className="d-flex min-vh-100">
      <aside
        className={`d-none d-lg-flex flex-column text-white lms-bg-purple lms-sidebar ${collapsed ? "lms-sidebar-collapsed" : ""}`}
      >
        <div className="lms-sidebar-top">
          <div className={`lms-sidebar-brand ${collapsed ? "is-collapsed" : ""}`}>
            <img src={logo} alt="Workians" className="lms-sidebar-logo" />
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="lms-sidebar-toggle"
            title={collapsed ? "Expand menu" : "Minimize menu"}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Minimize sidebar"}
          >
            <FiMenu />
          </button>
        </div>

        <nav className="lms-sidebar-nav">
          <NavLink
            to={feedNavItem.path}
            title={collapsed ? feedNavItem.label : undefined}
            className={() =>
              `lms-nav-link ${collapsed ? "lms-nav-link-collapsed" : ""} ${linkIsActive(feedNavItem.path) ? "active" : ""}`
            }
          >
            <SidebarLinkLabel {...feedNavItem} collapsed={collapsed} />
          </NavLink>
        </nav>

        <div className={`student-starter-panel ${collapsed ? "collapsed" : ""}`}>
          {collapsed ? (
            <NavLink
              to="/dashboard/student-start-here"
              title="Sell It Starter"
              className={`lms-nav-link lms-nav-link-collapsed ${isStarterRouteActive ? "active" : ""}`}
            >
              <span className="lms-nav-icon-wrap" aria-hidden="true">
                <FiGrid className="lms-nav-icon" />
              </span>
              <span className="lms-nav-short">SI</span>
            </NavLink>
          ) : (
            <>
              <button
                type="button"
                className="student-starter-panel-head"
                onClick={() => setStarterMenuOpen((prev) => !prev)}
                aria-expanded={showStarterMenu}
              >
                <span className="student-starter-panel-title">Sell It Starter</span>
                <span className="student-starter-panel-more" aria-hidden="true">
                  {showStarterMenu ? <FiChevronDown /> : <FiChevronRight />}
                </span>
              </button>
              {showStarterMenu && (
                <div className="student-starter-panel-list">
                  {starterNavItems.map((item) => {
                    return (
                      <NavLink
                        key={`starter-panel-${item.label}`}
                        to={item.path}
                        className={`student-starter-panel-link ${linkIsActive(item.path) ? "active" : ""}`}
                      >
                        <span className="student-starter-panel-icon" aria-hidden="true">
                          {item.icon}
                        </span>
                        <span className="student-starter-panel-label">{item.label}</span>
                        {item.label === "Start Here" && <span className="student-starter-panel-badge">NEW</span>}
                        {item.label === "Sell It Snacks" && <span className="student-starter-panel-count">1</span>}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className={`student-starter-nav student-starter-nav-top ${collapsed ? "collapsed" : ""}`}>
          <button
            type="button"
            className={`lms-nav-link lms-nav-link-button student-starter-title ${isStarterRouteActive ? "active" : ""} ${collapsed ? "lms-nav-link-collapsed collapsed" : ""}`}
            onClick={() => setStarterMenuOpen((prev) => !prev)}
            title={collapsed ? "Sell It Starter" : undefined}
            aria-expanded={showStarterMenu}
          >
            {collapsed ? (
              <>
                <span className="lms-nav-icon-wrap" aria-hidden="true">
                  <FiGrid className="lms-nav-icon" />
                </span>
                <span className="lms-nav-short">SI</span>
              </>
            ) : (
              <>
                <span className="lms-nav-link-main">
                  <span className="lms-nav-icon-wrap" aria-hidden="true">
                    <FiGrid className="lms-nav-icon" />
                  </span>
                  <span>Sell It Starter</span>
                </span>
                <span>{showStarterMenu ? "â–¾" : "â–¸"}</span>
              </>
            )}
          </button>
          {showStarterMenu && (
            <div className="student-starter-menu">
              {starterNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  className={() =>
                    `student-starter-link ${linkIsActive(item.path) ? "active" : ""} ${collapsed ? "justify-content-center" : ""}`
                  }
                >
                  <span className="student-starter-icon" aria-hidden="true">{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                  {collapsed && <span className="visually-hidden">{item.label}</span>}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        <nav className="lms-sidebar-nav">
          {studentNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={() =>
                `lms-nav-link ${collapsed ? "lms-nav-link-collapsed" : ""} ${linkIsActive(item.path) ? "active" : ""}`
              }
            >
              <SidebarLinkLabel {...item} collapsed={collapsed} />
            </NavLink>
          ))}
          <div className={`student-starter-nav ${collapsed ? "collapsed" : ""}`}>
            <button
              type="button"
              className={`lms-nav-link lms-nav-link-button student-starter-title ${isStarterRouteActive ? "active" : ""} ${collapsed ? "lms-nav-link-collapsed collapsed" : ""}`}
              onClick={() => setStarterMenuOpen((prev) => !prev)}
              title={collapsed ? "Sell It Starter" : undefined}
              aria-expanded={showStarterMenu}
            >
              {collapsed ? (
                <>
                  <span className="lms-nav-icon-wrap" aria-hidden="true">
                    <FiGrid className="lms-nav-icon" />
                  </span>
                  <span className="lms-nav-short">SI</span>
                </>
              ) : (
                <>
                  <span className="lms-nav-link-main">
                    <span className="lms-nav-icon-wrap" aria-hidden="true">
                      <FiGrid className="lms-nav-icon" />
                    </span>
                    <span>Sell It Starter</span>
                  </span>
                  <span>{showStarterMenu ? "▾" : "▸"}</span>
                </>
              )}
            </button>
            {showStarterMenu && (
              <div className="student-starter-menu">
                {starterNavItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={collapsed ? item.label : undefined}
                    className={() =>
                      `student-starter-link ${linkIsActive(item.path) ? "active" : ""} ${collapsed ? "justify-content-center" : ""}`
                    }
                  >
                    <span className="student-starter-icon" aria-hidden="true">{item.icon}</span>
                    {!collapsed && <span>{item.label}</span>}
                    {collapsed && <span className="visually-hidden">{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </nav>

        {!collapsed && (
          <div className="lms-sidebar-card">
            <span className="lms-sidebar-card-kicker">Membership Flow</span>
            <strong className="lms-sidebar-card-title">Start, learn, and track wins</strong>
            <p className="lms-sidebar-card-copy mb-0">
              Jump into lessons, workshops, and saved resources from one clearer sidebar.
            </p>
          </div>
        )}

        <div className="lms-sidebar-footer">
          <button
            type="button"
            onClick={handleLogout}
            className={`lms-sidebar-logout ${collapsed ? "is-collapsed" : ""}`}
            title="Logout"
          >
            {collapsed ? "⎋" : "Logout"}
          </button>
        </div>
      </aside>

      <main className="flex-grow-1 p-3 p-sm-4 position-relative">
        <div className="student-panel-top-header mb-4">
          <div className="student-panel-top-nav">
            {topHeaderLinks.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`student-top-nav-link ${activeTopHeaderKey === item.key ? "active" : ""}`}
                onClick={() => navigate(item.path)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="student-panel-top-actions">
            <div className="student-search-chip">
              <input
                type="search"
                value={
                  typeof onTopHeaderSearchChange === "function"
                    ? (topHeaderSearchValue ?? "")
                    : undefined
                }
                onChange={onTopHeaderSearchChange}
                readOnly={typeof onTopHeaderSearchChange !== "function"}
                placeholder="Search..."
                className="student-search-input"
                aria-label="Search"
              />
            </div>
            <button
              type="button"
              className="student-icon-btn"
              aria-label="Notifications"
            >
              <FiBell />
            </button>

            <button
              type="button"
              className="student-icon-btn"
              aria-label="Messages"
              onClick={() => setShowMessagePanel((prev) => !prev)}
            >
              <FiMessageCircle />
            </button>

            <button
              type="button"
              className="student-icon-btn"
              aria-label="Bookmarks"
              onClick={() => setShowBookmarkPanel((prev) => !prev)}
            >
              <FiBookmark />
            </button>

            <button
              type="button"
              className="student-avatar-btn"
              aria-label="Profile"
            >
              {userInitial ? userInitial : <FiUser />}
            </button>
          </div>
        </div>
        {showMessagePanel && (
          <>
            <button
              type="button"
              className="student-bookmark-overlay"
              aria-label="Close message panel"
              onClick={() => setShowMessagePanel(false)}
            />
            <div className="student-message-modal lms-card">
              <div className="p-4 pb-3 border-bottom">
                <div className="d-flex justify-content-between align-items-center gap-2">
                  <h3 className="mb-0 fw-bold">Direct messages</h3>
                  <div className="d-flex align-items-center gap-2 text-muted">
                    <span className="student-message-tool">⌄⌄</span>
                    <span className="student-message-tool">＋</span>
                  </div>
                </div>
              </div>
              <div className="student-bookmark-tabs px-4 border-bottom">
                {messageTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`student-bookmark-tab ${activeMessageTab === tab.key ? "active" : ""}`}
                    onClick={() => setActiveMessageTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="student-message-body">
                {messageItems.map((message) => (
                  <div
                    key={message.id}
                    className={`student-message-item ${message.highlighted ? "active" : ""}`}
                  >
                    <div className="student-message-avatar">
                      {String(message.name || "U").trim().charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <h5 className="mb-0 fw-bold">{message.name}</h5>
                        <span className="text-muted">{message.date}</span>
                      </div>
                      <p className="mb-0 text-muted">{message.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        {showBookmarkPanel && (
          <>
            <button
              type="button"
              className="student-bookmark-overlay"
              aria-label="Close bookmark panel"
              onClick={() => setShowBookmarkPanel(false)}
            />
            <div className="student-bookmark-modal lms-card">
              <div className="p-4 pb-3 border-bottom">
                <h3 className="mb-0 fw-bold">Bookmarks</h3>
              </div>
              <div className="student-bookmark-tabs px-4 border-bottom">
                {bookmarkTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`student-bookmark-tab ${activeBookmarkTab === tab.key ? "active" : ""}`}
                    onClick={() => setActiveBookmarkTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="student-bookmark-body p-4">
                {activeBookmarkTab === "lessons" ? (
                  bookmarkLessons.length > 0 ? (
                    bookmarkLessons.map((lesson) => (
                      <div key={lesson.id} className="student-bookmark-entry">
                        <button
                          type="button"
                          className="student-bookmark-link w-100 text-start border-0 bg-transparent"
                          onClick={() => {
                            navigate(`/dashboard/student-course/${lesson.id}`);
                            setShowBookmarkPanel(false);
                          }}
                        >
                          <h5 className="mb-1 fw-bold">{lesson.title || "Untitled lesson"}</h5>
                          <p className="mb-0 text-muted">
                            {lesson.description || "No description available."}
                          </p>
                        </button>
                        <div className="d-flex justify-content-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger rounded-pill px-3"
                            onClick={() => onRemoveBookmarkLesson?.(lesson.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted mb-0">No bookmarked lessons yet.</p>
                  )
                ) : activeBookmarkTab === "media" ? (
                  bookmarkMediaFiles.length > 0 ? (
                    bookmarkMediaFiles.map((item) => (
                      <div key={`${item.courseId}-${item.videoId}`} className="student-bookmark-entry">
                        <button
                          type="button"
                          className="student-bookmark-link w-100 text-start border-0 bg-transparent"
                          onClick={() => {
                            if (item.openPath) {
                              navigate(item.openPath);
                              setShowBookmarkPanel(false);
                              return;
                            }
                            if (item.openUrl) {
                              window.open(item.openUrl, "_blank", "noopener,noreferrer");
                            }
                          }}
                        >
                          <h5 className="mb-1 fw-bold">{item.title || "Untitled media"}</h5>
                          <p className="mb-0 text-muted">
                            {item.shortDescription || item.description || "No description available."}
                          </p>
                        </button>
                        <div className="d-flex justify-content-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger rounded-pill px-3"
                            onClick={() => onRemoveBookmarkMedia?.(item.courseId, item.videoId)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted mb-0">No bookmarked media files yet.</p>
                  )
                ) : (
                  <p className="text-muted mb-0">
                    No bookmarked {activeBookmarkTab} yet.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
        {children || (
          <div
            className="lms-card p-5 d-flex align-items-center justify-content-center"
            style={{ minHeight: 220 }}
          >
            <div className="text-center">
              <h1 className="h3 fw-bold text-dark">
                {title || "Student Dashboard"}
              </h1>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

