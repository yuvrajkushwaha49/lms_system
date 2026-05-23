import { useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import logo from "../../assets/logo.png";
import {
  FiArrowUpRight,
  FiAward,
  FiBell,
  FiBookmark,
  FiCalendar,
  FiChevronDown,
  FiChevronRight,
  FiGrid,
  FiHome,
  FiLayers,
  FiMenu,
  FiMessageCircle,
  FiSearch,
  FiShoppingBag,
  FiUser,
  FiUsers,
} from "react-icons/fi";
import {
  buildMonthsMetaFromCourses,
  displayTitleForMonthKey,
  formatMonthlyChallengeLine,
  labelsArrayToMap,
  STUDENT_MONTHLY_CHALLENGES_PATH,
} from "../../utils/studentMonthlyChallengeMeta";
import LearningCenterSidebarSection from "../../components/LearningCenterSidebarSection";

const MONTHLY_CHALLENGE_ROW_EMOJIS = ["📱", "💼", "🎯", "📊", "✨", "📲"];

const COMMUNITY_NAV_ITEMS = [
  {
    key: "sell",
    label: "Sell It Community",
    path: "/dashboard/student-community",
    badgeKey: "sell-it-community",
    icon: "arrow",
  },
  {
    key: "dir",
    label: "Member Directory",
    path: "/dashboard/student-members",
    badgeKey: null,
    icon: "search",
  },
  {
    key: "ref",
    label: "Referral Partners",
    path: "/dashboard/student-community/referral-partners",
    badgeKey: "referral-partners",
    icon: "🤝",
  },
  {
    key: "list",
    label: "Community Listings",
    path: "/dashboard/student-community/listings",
    badgeKey: "community-listings",
    icon: "🏠",
  },
  {
    key: "wow",
    label: "Wall of Wins",
    path: "/dashboard/student-wall-of-wins",
    badgeKey: "wallOfWins",
    icon: "🏆",
  },
];

const STORAGE_KEY = "student_dashboard_sidebar_collapsed";

const studentNavItems = [];

const welcomeNavItems = [
  { label: "Start Here", icon: "🆕", short: "SH", path: "/dashboard/student-start-here" },
  { label: "Meet + Greet", icon: "👋", short: "MG", path: "/dashboard/student-meet-greet" },
  { label: "Ask Ryan Anything", icon: "s.", short: "AR", path: "/dashboard/student-ask-ryan" },
  { label: "Owning Manhattan", icon: "🏙", short: "OM", path: "/dashboard/student-owning-manhattan" },
  { label: "Community Input", icon: "✏️", short: "CI", path: "/dashboard/student-community" },
];

const starterNavItems = [
  { label: "Start Here", icon: "🆕", short: "SH", path: "/dashboard/start-here-starter" },
  // { label: "Live Workshops", icon: "🎬", short: "LW", path: "/dashboard/student-live-workshops" },
  { label: "Sell It Snacks", icon: "🍿", short: "SS", path: "/dashboard/student-sell-it-snacks" },
  { label: "Wall of Wins", icon: "🏆", short: "WW", path: "/dashboard/student-wall-of-wins" },
  { label: "FAQs", icon: "❓", short: "FAQ", path: "/dashboard/student-faqs" },
];

const topHeaderLinks = [
  { key: "home", label: "Home", path: "/dashboard/student-dashboard" },
  { key: "courses", label: "Courses", path: "/dashboard/student-course" },
  { key: "events", label: "Events", path: "/dashboard/student-workshops" },
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
  const [collapsed, setCollapsed] = useState(false);
  const [showBookmarkPanel, setShowBookmarkPanel] = useState(false);
  const [activeBookmarkTab, setActiveBookmarkTab] = useState("posts");
  const [showMessagePanel, setShowMessagePanel] = useState(false);
  const [activeMessageTab, setActiveMessageTab] = useState("inbox");
  const [starterMenuOpen, setStarterMenuOpen] = useState(true);
  const [welcomeMenuOpen, setWelcomeMenuOpen] = useState(true);
  const [communityMenuOpen, setCommunityMenuOpen] = useState(true);
  const [communitySummary, setCommunitySummary] = useState({ feedBySpace: {}, wallOfWins: 0 });
  const [monthlyChallengesMenuOpen, setMonthlyChallengesMenuOpen] = useState(true);
  const [monthlySidebar, setMonthlySidebar] = useState({
    loading: false,
    meta: [],
    labels: {},
  });

  const apiBaseUrl = useMemo(
    () => getApiBaseUrl(),
    [],
  );

  const isMonthlyChallengesRoute = pathname.startsWith(STUDENT_MONTHLY_CHALLENGES_PATH);

  useEffect(() => {
    if (!monthlyChallengesMenuOpen && !isMonthlyChallengesRoute) return undefined;
    const token = localStorage.getItem("token");
    if (!token) return undefined;
    let cancelled = false;
    (async () => {
      setMonthlySidebar((s) => ({ ...s, loading: true }));
      try {
        const [coursesRes, labelsRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/courses`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${apiBaseUrl}/api/monthly-challenge-months`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        const coursesPayload = await coursesRes.json();
        const courses =
          coursesRes.ok && coursesPayload.status === "success" && Array.isArray(coursesPayload.data)
            ? coursesPayload.data
            : [];
        const meta = buildMonthsMetaFromCourses(courses);
        let labels = {};
        if (labelsRes.ok) {
          const labelsPayload = await labelsRes.json();
          if (labelsPayload.status === "success" && Array.isArray(labelsPayload.data)) {
            labels = labelsArrayToMap(labelsPayload.data);
          }
        }
        if (!cancelled) setMonthlySidebar({ loading: false, meta, labels });
      } catch {
        if (!cancelled) setMonthlySidebar({ loading: false, meta: [], labels: {} });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [monthlyChallengesMenuOpen, isMonthlyChallengesRoute, apiBaseUrl]);

  useEffect(() => {
    if (!monthlyChallengesMenuOpen && !isMonthlyChallengesRoute) {
      setMonthlySidebar({ loading: false, meta: [], labels: {} });
    }
  }, [monthlyChallengesMenuOpen, isMonthlyChallengesRoute]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const isStartHereCourseDetail = pathname.startsWith("/dashboard/student-course/") && new URLSearchParams(search).get("from") === "start-here";
  const isOwningManhattanCourseDetail =
    pathname.startsWith("/dashboard/student-course/") && new URLSearchParams(search).get("from") === "owning-manhattan";
  const linkIsActive = (path) => {
    if (path === "/dashboard/student-start-here" && isStartHereCourseDetail) return true;
    if (path === "/dashboard/student-course" && isStartHereCourseDetail) return false;
    if (path === "/dashboard/student-owning-manhattan" && isOwningManhattanCourseDetail) return true;
    if (path === "/dashboard/student-course" && isOwningManhattanCourseDetail) return false;
    return pathname === path || pathname.startsWith(`${path}/`);
  };
  const isCommunityRouteActive = COMMUNITY_NAV_ITEMS.some((item) => linkIsActive(item.path));
  const showCommunityMenu = communityMenuOpen || isCommunityRouteActive;
  const showMonthlyChallengesMenu = monthlyChallengesMenuOpen;
  const isMonthlyChallengesNavActive = linkIsActive(STUDENT_MONTHLY_CHALLENGES_PATH);
  const isStarterRouteActive = starterNavItems.some((item) => linkIsActive(item.path));
  const isWelcomeRouteActive = welcomeNavItems.some((item) => linkIsActive(item.path));
  const showStarterMenu = starterMenuOpen;
  const showWelcomeMenu = welcomeMenuOpen;
  const activeTopHeaderKey = pathname.startsWith("/dashboard/student-owning-manhattan") || isOwningManhattanCourseDetail
    ? "owning-manhattan"
    : pathname.startsWith("/dashboard/student-course") ||
        pathname.startsWith(STUDENT_MONTHLY_CHALLENGES_PATH)
      ? "courses"
      : pathname.startsWith("/dashboard/student-workshops")
        ? "events"
        : pathname.startsWith("/dashboard/feed") ||
            pathname.startsWith("/dashboard/student-community") ||
            pathname.startsWith("/dashboard/student-members") ||
            pathname.startsWith("/dashboard/student-wall-of-wins")
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

  useEffect(() => {
    if (isWelcomeRouteActive) {
      setWelcomeMenuOpen(true);
    }
  }, [isWelcomeRouteActive]);

  useEffect(() => {
    if (isMonthlyChallengesRoute) {
      setMonthlyChallengesMenuOpen(true);
    }
  }, [isMonthlyChallengesRoute]);

  useEffect(() => {
    if (isCommunityRouteActive) {
      setCommunityMenuOpen(true);
    }
  }, [isCommunityRouteActive]);

  useEffect(() => {
    if (!communityMenuOpen && !isCommunityRouteActive) return undefined;
    const token = localStorage.getItem("token");
    if (!token) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/feed/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await res.json();
        if (!res.ok || payload.status !== "success") return;
        if (!cancelled) {
          setCommunitySummary({
            feedBySpace: payload.data?.feedBySpace || {},
            wallOfWins: Number(payload.data?.wallOfWins) || 0,
          });
        }
      } catch {
        if (!cancelled) setCommunitySummary({ feedBySpace: {}, wallOfWins: 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [communityMenuOpen, isCommunityRouteActive, apiBaseUrl]);

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
            onClick={() => {}}
            className="lms-sidebar-toggle"
            disabled
            title="Sidebar always expanded"
            aria-expanded={true}
            aria-label="Sidebar always expanded"
          >
            <FiMenu />
          </button>
        </div>

<div className="side-bars">
        <NavLink
          to="/dashboard/feed"
          title={collapsed ? "Feed" : undefined}
          className={() =>
            `lms-nav-link student-sidebar-feed-link ${collapsed ? "lms-nav-link-collapsed" : ""} ${linkIsActive("/dashboard/feed") ? "active" : ""}`
          }
        >
          <SidebarLinkLabel icon={FiLayers} label="Feed" short="FD" collapsed={collapsed} />
        </NavLink>


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

        <div className={`student-starter-panel ${collapsed ? "collapsed" : ""}`}>
          {collapsed ? (
            <NavLink
              to="/dashboard/student-start-here"
              title="Welcome"
              className={`lms-nav-link lms-nav-link-collapsed ${isWelcomeRouteActive ? "active" : ""}`}
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
                  {welcomeNavItems.map((item) => {
                    const isCommunityInput = item.label === "Community Input";
                    if (isCommunityInput) {
                      return (
                        <button
                          key={`welcome-panel-${item.path}`}
                          type="button"
                          className="student-starter-panel-link student-starter-panel-link-disabled"
                          title="Coming soon"
                          disabled
                        >
                          <span className="student-starter-panel-icon" aria-hidden="true">
                            {item.icon}
                          </span>
                          <span className="student-starter-panel-label">{item.label}</span>
                          <span className="student-starter-soon-badge">Coming soon</span>
                        </button>
                      );
                    }
                    return (
                      <NavLink
                        key={`welcome-panel-${item.path}`}
                        to={item.path}
                        className={`student-starter-panel-link ${linkIsActive(item.path) ? "active" : ""}`}
                      >
                        <span className="student-starter-panel-icon" aria-hidden="true">
                          {item.icon}
                        </span>
                        <span className="student-starter-panel-label">{item.label}</span>
                        {item.label === "Start Here" && <span className="student-starter-panel-badge">NEW</span>}
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
            className={`lms-nav-link lms-nav-link-button student-starter-title ${isWelcomeRouteActive ? "active" : ""} ${collapsed ? "lms-nav-link-collapsed collapsed" : ""}`}
            onClick={() => setWelcomeMenuOpen((prev) => !prev)}
            title="Welcome!"
            aria-expanded={showWelcomeMenu}
          >
            {collapsed ? (
              <>
                <span className="lms-nav-icon-wrap" aria-hidden="true">
                  <FiHome className="lms-nav-icon" />
                </span>
                <span className="lms-nav-short">W</span>
              </>
            ) : (
              <>
                <span className="lms-nav-link-main">
                  <span className="lms-nav-icon-wrap" aria-hidden="true">
                    <FiHome className="lms-nav-icon" />
                  </span>
                  <span>Welcome!</span>
                </span>
                <span>{showWelcomeMenu ? "▾" : "▸"}</span>
              </>
            )}
          </button>
          {showWelcomeMenu && (
            <div className="student-starter-menu">
              {welcomeNavItems.map((item) => {
                const isCommunityInput = item.label === "Community Input";
                if (isCommunityInput) {
                  return (
                    <button
                      key={`welcome-nav-${item.path}`}
                      type="button"
                      className={`student-starter-link student-starter-link-disabled ${collapsed ? "justify-content-center" : ""}`}
                      title={collapsed ? `${item.label} (Coming soon)` : "Coming soon"}
                      disabled
                    >
                      <span className="student-starter-icon" aria-hidden="true">{item.icon}</span>
                      {!collapsed && (
                        <>
                          <span>{item.label}</span>
                          <span className="student-starter-soon-badge">Coming soon</span>
                        </>
                      )}
                      {collapsed && <span className="visually-hidden">{item.label} coming soon</span>}
                    </button>
                  );
                }
                return (
                  <NavLink
                    key={`welcome-nav-${item.path}`}
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
                );
              })}
            </div>
          )}
        </div>

        <div className={`student-starter-nav student-starter-nav-top ${collapsed ? "collapsed" : ""}`}>
          <button
            type="button"
            className={`lms-nav-link lms-nav-link-button student-starter-title ${isStarterRouteActive ? "active" : ""} ${collapsed ? "lms-nav-link-collapsed collapsed" : ""}`}
            onClick={() => setStarterMenuOpen((prev) => !prev)}
            title="Sell It Starter"
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
                  {!collapsed && (
                    <>
                      <span>{item.label}</span>
                      {item.label === "Start Here" && <span className="student-starter-panel-badge">NEW</span>}
                    </>
                  )}
                  {collapsed && <span className="visually-hidden">{item.label}</span>}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        <nav className="lms-sidebar-nav">
          <div className={`student-starter-nav student-starter-nav-community ${collapsed ? "collapsed" : ""}`}>
            <button
              type="button"
              className={`lms-nav-link lms-nav-link-button student-starter-title ${isCommunityRouteActive ? "active" : ""} ${collapsed ? "lms-nav-link-collapsed collapsed" : ""}`}
              onClick={() => setCommunityMenuOpen((prev) => !prev)}
              title="Community"
              aria-expanded={showCommunityMenu}
            >
              {collapsed ? (
                <>
                  <span className="lms-nav-icon-wrap" aria-hidden="true">
                    <FiUsers className="lms-nav-icon" />
                  </span>
                  <span className="lms-nav-short">CM</span>
                </>
              ) : (
                <>
                  <span className="lms-nav-link-main">
                    <span className="lms-nav-icon-wrap" aria-hidden="true">
                      <FiUsers className="lms-nav-icon" />
                    </span>
                    <span>Community</span>
                  </span>
                  <span>{showCommunityMenu ? "▾" : "▸"}</span>
                </>
              )}
            </button>
            {showCommunityMenu && (
              <div className="student-starter-menu">
                {COMMUNITY_NAV_ITEMS.map((item) => {
                  const badgeCount =
                    item.badgeKey === "wallOfWins"
                      ? communitySummary.wallOfWins
                      : item.badgeKey != null
                        ? communitySummary.feedBySpace[item.badgeKey] ?? null
                        : null;
                  const showBadge = badgeCount != null && !Number.isNaN(Number(badgeCount));
                  return (
                    <NavLink
                      key={item.key}
                      to={item.path}
                      title={collapsed ? item.label : undefined}
                      className={() =>
                        `student-starter-link student-starter-link-community ${linkIsActive(item.path) ? "active" : ""} ${collapsed ? "justify-content-center" : ""}`
                      }
                    >
                      <span className="student-starter-icon" aria-hidden="true">
                        {item.icon === "arrow" ? (
                          <span className="community-sidebar-ico-sell">➤</span>
                        ) : item.icon === "search" ? (
                          <FiSearch className="community-sidebar-fi" />
                        ) : (
                          item.icon
                        )}
                      </span>
                      {!collapsed && (
                        <>
                          <span className="flex-grow-1 text-truncate" style={{ minWidth: 0 }}>
                            {item.label}
                          </span>
                          {showBadge ? (
                            <span className="student-community-sidebar-count">{badgeCount}</span>
                          ) : null}
                        </>
                      )}
                      {collapsed && <span className="visually-hidden">{item.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            )}
          </div>
          <div className={`student-starter-nav student-starter-nav-monthly ${collapsed ? "collapsed" : ""}`}>
            <button
              type="button"
              className={`lms-nav-link lms-nav-link-button student-starter-title ${isMonthlyChallengesNavActive ? "active" : ""} ${collapsed ? "lms-nav-link-collapsed collapsed" : ""}`}
              onClick={() => setMonthlyChallengesMenuOpen((prev) => !prev)}
              title="Monthly Challenges"
              aria-expanded={showMonthlyChallengesMenu}
            >
              {collapsed ? (
                <>
                  <span className="lms-nav-icon-wrap" aria-hidden="true">
                    <FiCalendar className="lms-nav-icon" />
                  </span>
                  <span className="lms-nav-short">MO</span>
                </>
              ) : (
                <>
                  <span className="lms-nav-link-main">
                    <span className="lms-nav-icon-wrap" aria-hidden="true">
                      <FiCalendar className="lms-nav-icon" />
                    </span>
                    <span>Monthly Challenges</span>
                  </span>
                  <span>{showMonthlyChallengesMenu ? "▾" : "▸"}</span>
                </>
              )}
            </button>
            {showMonthlyChallengesMenu && (
              <div className="student-starter-menu">
                {monthlySidebar.loading ? (
                  <div className="student-starter-link student-starter-link-disabled text-muted py-2 px-2">
                    {!collapsed ? "Loading months…" : "…"}
                  </div>
                ) : monthlySidebar.meta.length === 0 ? (
                  <div className="student-starter-link student-starter-link-disabled text-muted py-2 px-2">
                    {!collapsed ? "No months yet." : "—"}
                  </div>
                ) : (
                  monthlySidebar.meta.map(({ key, count }, index) => {
                    const cur = new URLSearchParams(search).get("month");
                    const firstKey = monthlySidebar.meta[0]?.key;
                    const isMonthActive =
                      isMonthlyChallengesRoute && (cur === key || (!cur && key === firstKey));
                    const line = formatMonthlyChallengeLine(key, monthlySidebar.labels);
                    const tip = `${displayTitleForMonthKey(key, monthlySidebar.labels)} — ${count} course${count === 1 ? "" : "s"}`;
                    const emoji =
                      MONTHLY_CHALLENGE_ROW_EMOJIS[index % MONTHLY_CHALLENGE_ROW_EMOJIS.length];
                    return (
                      <Link
                        key={`mc-month-${key}`}
                        to={`${STUDENT_MONTHLY_CHALLENGES_PATH}?month=${encodeURIComponent(key)}`}
                        title={tip}
                        className={`student-starter-link ${isMonthActive ? "active" : ""} ${collapsed ? "justify-content-center" : ""}`}
                      >
                        <span className="student-starter-icon" aria-hidden="true">
                          {emoji}
                        </span>
                        {!collapsed && (
                          <span className="text-truncate" style={{ maxWidth: "11.5rem" }}>
                            {line}
                          </span>
                        )}
                        {collapsed && <span className="visually-hidden">{line}</span>}
                      </Link>
                    );
                  })
                )}
              </div>
            )}
          </div>
          <NavLink
            to="/dashboard/student-live-workshops"
            title={collapsed ? "Join Us LIVE" : undefined}
            className={() =>
              `lms-nav-link student-sidebar-live-link ${collapsed ? "lms-nav-link-collapsed" : ""} ${linkIsActive("/dashboard/student-live-workshops") ? "active" : ""}`
            }
          >
            <SidebarLinkLabel icon={FiAward} label="Join Us LIVE" short="LV" collapsed={collapsed} />
          </NavLink>
          <LearningCenterSidebarSection variant="student" collapsed={collapsed} />
          {!collapsed && (
            <div className="student-sidebar-links-group">
              <div className="student-sidebar-links-label">Links</div>
              <button
                type="button"
                className="student-sidebar-links-item"
                onClick={() => navigate("/dashboard/student-faqs")}
              >
                <FiArrowUpRight className="student-sidebar-links-icon" aria-hidden="true" />
                <span>Contact Us</span>
              </button>
            </div>
          )}
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
              className={`lms-nav-link lms-nav-link-button student-starter-title ${isWelcomeRouteActive ? "active" : ""} ${collapsed ? "lms-nav-link-collapsed collapsed" : ""}`}
              onClick={() => setWelcomeMenuOpen((prev) => !prev)}
              title="Welcome!"
              aria-expanded={showWelcomeMenu}
            >
              {collapsed ? (
                <>
                  <span className="lms-nav-icon-wrap" aria-hidden="true">
                    <FiHome className="lms-nav-icon" />
                  </span>
                  <span className="lms-nav-short">W</span>
                </>
              ) : (
                <>
                  <span className="lms-nav-link-main">
                    <span className="lms-nav-icon-wrap" aria-hidden="true">
                      <FiHome className="lms-nav-icon" />
                    </span>
                    <span>Welcome!</span>
                  </span>
                  <span>{showWelcomeMenu ? "▾" : "▸"}</span>
                </>
              )}
            </button>
            {showWelcomeMenu && (
              <div className="student-starter-menu">
                {welcomeNavItems.map((item) => {
                  const isCommunityInput = item.label === "Community Input";
                  if (isCommunityInput) {
                    return (
                      <button
                        key={`welcome-inner-${item.path}`}
                        type="button"
                        className={`student-starter-link student-starter-link-disabled ${collapsed ? "justify-content-center" : ""}`}
                        title={collapsed ? `${item.label} (Coming soon)` : "Coming soon"}
                        disabled
                      >
                        <span className="student-starter-icon" aria-hidden="true">
                          {item.icon}
                        </span>
                        {!collapsed && (
                          <>
                            <span>{item.label}</span>
                            <span className="student-starter-soon-badge">Coming soon</span>
                          </>
                        )}
                        {collapsed && <span className="visually-hidden">{item.label} coming soon</span>}
                      </button>
                    );
                  }

                  return (
                    <NavLink
                      key={`welcome-inner-${item.path}`}
                      to={item.path}
                      title={collapsed ? item.label : undefined}
                      className={() =>
                        `student-starter-link ${linkIsActive(item.path) ? "active" : ""} ${collapsed ? "justify-content-center" : ""}`
                      }
                    >
                      <span className="student-starter-icon" aria-hidden="true">
                        {item.icon}
                      </span>
                      {!collapsed && <span>{item.label}</span>}
                      {collapsed && <span className="visually-hidden">{item.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            )}
          </div>
          <div className={`student-starter-nav ${collapsed ? "collapsed" : ""}`}>
            <button
              type="button"
              className={`lms-nav-link lms-nav-link-button student-starter-title ${isStarterRouteActive ? "active" : ""} ${collapsed ? "lms-nav-link-collapsed collapsed" : ""}`}
              onClick={() => setStarterMenuOpen((prev) => !prev)}
              title="Sell It Starter"
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
                    {!collapsed && (
                      <>
                        <span>{item.label}</span>
                        {item.label === "Start Here" && <span className="student-starter-panel-badge">NEW</span>}
                      </>
                    )}
                    {collapsed && <span className="visually-hidden">{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </nav>
        </div>

        {!collapsed && (
          <div className="lms-sidebar-card">
            <span className="lms-sidebar-card-kicker">Membership Flow</span>
            <strong className="lms-sidebar-card-title">Start, learn, and track wins</strong>
            <p className="lms-sidebar-card-copy mb-0">
              Jump into lessons, workshops, and saved resources from one clearer sidebar.
            </p>
          </div>
        )}

        {/* <div className="lms-sidebar-footer">
          <button
            type="button"
            onClick={handleLogout}
            className={`lms-sidebar-logout ${collapsed ? "is-collapsed" : ""}`}
            title="Logout"
          >
            {collapsed ? "⎋" : "Logout"}
          </button>
        </div> */}
      </aside>

      <div className="flexss-fs p-3 p-sm-4 position-relative">
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
      </div>
    </div>
  );
}
