import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import { StudentHeaderSearchContext } from "../../contexts/StudentHeaderSearchContext";
import { SidebarLinksSkeleton } from "../../components/skeletons/LoadingSkeletons";

import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import logo from "../../assets/logo.png";
import smallLogo from "../../assets/small_logo.png";
import {
  FiArrowUpRight,
  FiAward,
  FiBell,
  FiBookmark,
  FiCalendar,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiGrid,
  FiHome,
  FiLayers,
  FiLogOut,
  FiMessageCircle,
  FiSearch,
  FiShoppingBag,
  FiSun,
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
import {
  studentSidebarSession,
  syncMonthlySidebarCache,
  syncSidebarCollapsed,
} from "../../utils/studentSidebarSession";
import {
  COMMUNITY_NAV_KEY_BY_ITEM,
  STARTER_NAV_KEY_BY_PATH,
  TOP_NAV_KEY_BY_ITEM,
  WELCOME_NAV_KEY_BY_PATH,
  defaultStudentNavVisibility,
  isNavVisible,
  readCachedStudentNavVisibility,
  writeCachedStudentNavVisibility,
} from "../../utils/studentNavVisibility";

const MONTHLY_CHALLENGE_ROW_EMOJIS = ["📱", "💼", "🎯", "📊", "✨", "📲"];

const COMMUNITY_NAV_ITEMS = [
  {
    key: "sell",
    label: "Sell It Community",
    short: "Sell It",
    path: "/dashboard/student-community",
    icon: "arrow",
  },
  {
    key: "dir",
    label: "Member Directory",
    short: "Members",
    path: "/dashboard/student-members",
    icon: "search",
  },
  {
    key: "ref",
    label: "Referral Partners",
    short: "Referral",
    path: "/dashboard/student-community/referral-partners",
    icon: "🤝",
  },
  {
    key: "list",
    label: "Community Listings",
    short: "Listings",
    path: "/dashboard/student-community/listings",
    icon: "🏠",
  },
  {
    key: "wow",
    label: "Wall of Wins",
    short: "Wins",
    path: "/dashboard/student-wall-of-wins",
    icon: "🏆",
  },
];

const studentNavItems = [];

const welcomeNavItems = [
  { label: "Start Here", icon: "🆕", short: "Start", path: "/dashboard/student-start-here" },
  { label: "Meet + Greet", icon: "👋", short: "Meet", path: "/dashboard/student-meet-greet" },
  { label: "Ask Ryan Anything", icon: "s.", short: "Ask", path: "/dashboard/student-ask-ryan" },
  { label: "Owning Manhattan", icon: "🏙", short: "Owning", path: "/dashboard/student-owning-manhattan" },
  { label: "Community Input", icon: "✏️", short: "Input", path: "/coming-soon?feature=Community%20Input" },
  { label: "Welcome to the Sell It family! 💙", icon: "💙", short: "Family", path: "/dashboard/student-welcome-family" },
];

const starterNavItems = [
  { label: "Start Here", icon: "🆕", short: "Start", path: "/dashboard/start-here-starter" },
  { label: "Live Workshops", icon: "🎬", short: "Live", path: "/dashboard/student-live-workshops" },
  { label: "Sell It Snacks", icon: "🍿", short: "Snacks", path: "/dashboard/student-sell-it-snacks" },
  { label: "Wall of Wins", icon: "🏆", short: "Wins", path: "/dashboard/student-wall-of-wins" },
  { label: "FAQs", icon: "❓", short: "FAQs", path: "/dashboard/student-faqs" },
];

const topHeaderLinks = [
  { key: "home", label: "Home", path: "/dashboard/student-dashboard" },
  { key: "courses", label: "Courses", path: "/dashboard/student-course" },
  { key: "events", label: "Events", path: "/dashboard/student-live-workshops" },
  { key: "leaderboard", label: "Leaderboard", path: "/coming-soon?feature=Leaderboard" },
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
  const sidebarRef = useRef(null);
  const [collapsed, setCollapsed] = useState(() => Boolean(studentSidebarSession.collapsed));
  const [showBookmarkPanel, setShowBookmarkPanel] = useState(false);
  const [activeBookmarkTab, setActiveBookmarkTab] = useState("posts");
  const [showMessagePanel, setShowMessagePanel] = useState(false);
  const [activeMessageTab, setActiveMessageTab] = useState("inbox");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);
  const [internalHeaderSearch, setInternalHeaderSearch] = useState("");
  const isHeaderSearchControlled = typeof onTopHeaderSearchChange === "function";
  const headerSearch = isHeaderSearchControlled
    ? (topHeaderSearchValue ?? "")
    : internalHeaderSearch;
  const setHeaderSearch = useCallback(
    (value) => {
      if (isHeaderSearchControlled) {
        onTopHeaderSearchChange({ target: { value } });
      } else {
        setInternalHeaderSearch(value);
      }
    },
    [isHeaderSearchControlled, onTopHeaderSearchChange],
  );
  const handleHeaderSearchChange = useCallback(
    (event) => setHeaderSearch(event.target.value),
    [setHeaderSearch],
  );
  const [starterMenuOpen, setStarterMenuOpen] = useState(
    () => studentSidebarSession.starterMenuOpen,
  );
  const [welcomeMenuOpen, setWelcomeMenuOpen] = useState(
    () => studentSidebarSession.welcomeMenuOpen,
  );
  const [communityMenuOpen, setCommunityMenuOpen] = useState(
    () => studentSidebarSession.communityMenuOpen,
  );
  const [monthlyChallengesMenuOpen, setMonthlyChallengesMenuOpen] = useState(
    () => studentSidebarSession.monthlyChallengesMenuOpen,
  );
  const [navVisibility, setNavVisibility] = useState(
    () => readCachedStudentNavVisibility() || defaultStudentNavVisibility(),
  );
  const [navVisibilityReady, setNavVisibilityReady] = useState(
    () => Boolean(readCachedStudentNavVisibility()),
  );
  const [monthlySidebar, setMonthlySidebar] = useState(() => ({
    loading: false,
    meta: studentSidebarSession.monthlySidebar.meta || [],
    labels: studentSidebarSession.monthlySidebar.labels || {},
  }));

  const apiBaseUrl = useMemo(
    () => getApiBaseUrl(),
    [],
  );

  const navOn = useCallback((key) => isNavVisible(navVisibility, key), [navVisibility]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setNavVisibilityReady(true);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/student-nav-visibility`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await res.json();
        if (!cancelled && res.ok && payload.status === "success" && payload.data?.visibility) {
          const next = writeCachedStudentNavVisibility(payload.data.visibility);
          setNavVisibility((prev) => {
            try {
              if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
            } catch {
              /* fall through */
            }
            return next;
          });
        }
      } catch {
        /* keep cache / defaults */
      } finally {
        if (!cancelled) setNavVisibilityReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  useLayoutEffect(() => {
    const el = sidebarRef.current;
    if (!el) return undefined;
    el.scrollTop = studentSidebarSession.scrollTop || 0;
    const onScroll = () => {
      studentSidebarSession.scrollTop = el.scrollTop;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    studentSidebarSession.starterMenuOpen = starterMenuOpen;
  }, [starterMenuOpen]);

  useEffect(() => {
    studentSidebarSession.welcomeMenuOpen = welcomeMenuOpen;
  }, [welcomeMenuOpen]);

  useEffect(() => {
    studentSidebarSession.communityMenuOpen = communityMenuOpen;
  }, [communityMenuOpen]);

  useEffect(() => {
    studentSidebarSession.monthlyChallengesMenuOpen = monthlyChallengesMenuOpen;
  }, [monthlyChallengesMenuOpen]);

  useEffect(() => {
    syncSidebarCollapsed(collapsed);
  }, [collapsed]);

  const visibleStarterNavItems = useMemo(
    () =>
      starterNavItems.filter((item) => {
        const key = STARTER_NAV_KEY_BY_PATH[item.path];
        return key ? navOn(key) : true;
      }),
    [navOn],
  );

  const visibleWelcomeNavItems = useMemo(
    () =>
      welcomeNavItems.filter((item) => {
        const basePath = item.path.split("?")[0];
        const key = WELCOME_NAV_KEY_BY_PATH[basePath];
        return key ? navOn(key) : true;
      }),
    [navOn],
  );

  const visibleCommunityNavItems = useMemo(
    () =>
      COMMUNITY_NAV_ITEMS.filter((item) => {
        const key = COMMUNITY_NAV_KEY_BY_ITEM[item.key];
        return key ? navOn(key) : true;
      }),
    [navOn],
  );

  const visibleTopHeaderLinks = useMemo(
    () =>
      topHeaderLinks.filter((item) => {
        const key = TOP_NAV_KEY_BY_ITEM[item.key];
        return key ? navOn(key) : true;
      }),
    [navOn],
  );

  const isMonthlyChallengesRoute = pathname.startsWith(STUDENT_MONTHLY_CHALLENGES_PATH);

  useEffect(() => {
    if (!monthlyChallengesMenuOpen && !isMonthlyChallengesRoute) return undefined;
    const token = localStorage.getItem("token");
    if (!token) return undefined;

    const hasCache = (studentSidebarSession.monthlySidebar.meta || []).length > 0;
    // Skip refetch for a short window after a successful load (route clicks remount this page)
    const fetchedAt = studentSidebarSession.monthlySidebar.fetchedAt || 0;
    if (hasCache && Date.now() - fetchedAt < 60_000) {
      return undefined;
    }

    let cancelled = false;
    (async () => {
      if (!hasCache) {
        setMonthlySidebar((s) => ({ ...s, loading: true }));
      }
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
        if (!cancelled) {
          const cached = syncMonthlySidebarCache({ meta, labels });
          setMonthlySidebar({
            loading: false,
            meta: cached.meta,
            labels: cached.labels,
          });
        }
      } catch {
        if (!cancelled && !hasCache) {
          setMonthlySidebar({ loading: false, meta: [], labels: {} });
        } else if (!cancelled) {
          setMonthlySidebar((s) => ({ ...s, loading: false }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [monthlyChallengesMenuOpen, isMonthlyChallengesRoute, apiBaseUrl]);
  useEffect(() => {
    if (!isHeaderSearchControlled) {
      setInternalHeaderSearch("");
    }
  }, [pathname, isHeaderSearchControlled]);

  const headerSearchContextValue = useMemo(
    () => ({ search: headerSearch, setSearch: setHeaderSearch }),
    [headerSearch, setHeaderSearch],
  );

  const isStartHereCourseDetail = pathname.startsWith("/dashboard/student-course/") && new URLSearchParams(search).get("from") === "start-here";
  const isOwningManhattanCourseDetail =
    pathname.startsWith("/dashboard/student-course/") && new URLSearchParams(search).get("from") === "owning-manhattan";
  const linkIsActive = (path) => {
    if (path === "/dashboard/student-start-here" && isStartHereCourseDetail) return true;
    if (path === "/dashboard/student-course" && isStartHereCourseDetail) return false;
    if (path === "/dashboard/student-owning-manhattan" && isOwningManhattanCourseDetail) return true;
    if (path === "/dashboard/student-course" && isOwningManhattanCourseDetail) return false;
    if (pathname === path) return true;
    // Sell It Community hub must not stay active on nested community routes
    // (referral-partners, listings, etc.)
    if (path === "/dashboard/student-community") return false;
    return pathname.startsWith(`${path}/`);
  };
  const isCommunityRouteActive = visibleCommunityNavItems.some((item) => linkIsActive(item.path));
  const showCommunityMenu = communityMenuOpen;
  const showMonthlyChallengesMenu = monthlyChallengesMenuOpen;
  const isMonthlyChallengesNavActive = linkIsActive(STUDENT_MONTHLY_CHALLENGES_PATH);
  const isStarterRouteActive = visibleStarterNavItems.some((item) => linkIsActive(item.path.split("?")[0]));
  const isWelcomeRouteActive = visibleWelcomeNavItems.some((item) => linkIsActive(item.path.split("?")[0]));
  const showStarterMenu = starterMenuOpen;
  const showWelcomeMenu = welcomeMenuOpen;
  const activeTopHeaderKey = pathname.startsWith("/dashboard/student-course") ||
      pathname.startsWith(STUDENT_MONTHLY_CHALLENGES_PATH)
      ? "courses"
      : pathname.startsWith("/dashboard/student-live-workshops")
        ? "events"
        : pathname.startsWith("/coming-soon") &&
            new URLSearchParams(search).get("feature") === "Leaderboard"
          ? "leaderboard"
          : pathname === "/dashboard/student-dashboard" || pathname === "/dashboard"
            ? "home"
            : null;
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userDisplayName =
    String(user?.name || "Student")
      .trim()
      .split(/\s+/)[0] || "Student";
  const userInitial =
    userDisplayName.charAt(0).toUpperCase() || "S";

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

  const SidebarLinkLabel = ({ icon: Icon, label, short, collapsed: isCollapsed }) => (
    <>
      <span className="lms-nav-icon-wrap" aria-hidden="true">
        <Icon className="lms-nav-icon" />
      </span>
      {isCollapsed ? (
        <span className="lms-nav-underlabel">{short || label}</span>
      ) : (
        <span>{label}</span>
      )}
    </>
  );

  const handleLogout = () => {
    setShowProfileMenu(false);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  useEffect(() => {
    if (!showProfileMenu) return undefined;
    const onPointerDown = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [showProfileMenu]);

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
    <StudentHeaderSearchContext.Provider value={headerSearchContextValue}>
      <div className="d-flex min-vh-100">
        <aside
          ref={sidebarRef}
          className={`d-none d-lg-flex flex-column lms-sidebar ${collapsed ? "lms-sidebar-collapsed" : ""}`}
        >
          <div className="lms-sidebar-top">
            <div className={`lms-sidebar-brand ${collapsed ? "is-collapsed" : ""}`}>
              <img
                src={collapsed ? smallLogo : logo}
                alt="Workians"
                className={`lms-sidebar-logo${collapsed ? " is-collapsed" : ""}`}
              />
            </div>
            <button
              type="button"
              onClick={() => setCollapsed((current) => !current)}
              className="lms-sidebar-toggle"
              title={collapsed ? "Expand menu" : "Minimize menu"}
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Expand sidebar" : "Minimize sidebar"}
            >
              {collapsed ? <FiChevronRight /> : <FiChevronLeft />}
            </button>
          </div>

          <div className="side-bars">
            {!navVisibilityReady ? (
              <SidebarLinksSkeleton count={collapsed ? 3 : 6} />
            ) : (
              <>
            {navOn("feed") && (
            <NavLink
              to="/dashboard/feed"
              title={collapsed ? "Feed" : undefined}
              className={() =>
                `lms-nav-link student-sidebar-feed-link ${collapsed ? "lms-nav-link-collapsed" : ""} ${linkIsActive("/dashboard/feed") ? "active" : ""}`
              }
            >
              <SidebarLinkLabel icon={FiHome} label="Feed" short="Feed" collapsed={collapsed} />
            </NavLink>
            )}

            {navOn("sell_it_starter") && visibleStarterNavItems.length > 0 && (
            <div className={`student-starter-panel ${collapsed ? "collapsed" : ""}`}>
              <button
                type="button"
                className={`student-starter-panel-head ${isStarterRouteActive ? "active" : ""} ${collapsed ? "lms-nav-link-collapsed collapsed" : ""}`}
                onClick={() => setStarterMenuOpen((prev) => !prev)}
                title="Sell It Starter"
                aria-expanded={showStarterMenu}
              >
                {collapsed ? (
                  <>
                    <span className="lms-nav-icon-wrap" aria-hidden="true">
                      <FiGrid className="lms-nav-icon" />
                    </span>
                    <span className="lms-nav-underlabel">Starter</span>
                    <span className="student-starter-panel-more is-collapsed-chevron" aria-hidden="true">
                      {showStarterMenu ? <FiChevronDown /> : <FiChevronRight />}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="student-starter-panel-title">Sell It Starter</span>
                    <span className="student-starter-panel-more" aria-hidden="true">
                      {showStarterMenu ? <FiChevronDown /> : <FiChevronRight />}
                    </span>
                  </>
                )}
              </button>
              {showStarterMenu && (
                <div className={`student-starter-panel-list ${collapsed ? "is-collapsed-rail" : ""}`}>
                  {visibleStarterNavItems.map((item) => (
                    <NavLink
                      key={`starter-panel-${item.label}`}
                      to={item.path}
                      title={collapsed ? item.label : undefined}
                      className={`student-starter-panel-link ${collapsed ? "is-collapsed-rail" : ""} ${linkIsActive(item.path) ? "active" : ""}`}
                    >
                      <span className="student-starter-panel-icon" aria-hidden="true">
                        {item.icon}
                      </span>
                      {collapsed ? (
                        <span className="lms-nav-underlabel">{item.short || item.label}</span>
                      ) : (
                        <>
                          <span className="student-starter-panel-label">{item.label}</span>
                          {item.label === "Start Here" && <span className="student-starter-panel-badge">NEW</span>}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
            )}

            {navOn("welcome") && visibleWelcomeNavItems.length > 0 && (
            <div className={`student-starter-panel ${collapsed ? "collapsed" : ""}`}>
              <button
                type="button"
                className={`student-starter-panel-head ${isWelcomeRouteActive ? "active" : ""} ${collapsed ? "lms-nav-link-collapsed collapsed" : ""}`}
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
                <div className={`student-starter-panel-list ${collapsed ? "is-collapsed-rail" : ""}`}>
                  {visibleWelcomeNavItems.map((item) => (
                    <NavLink
                      key={`welcome-panel-${item.path}`}
                      to={item.path}
                      title={collapsed ? item.label : undefined}
                      className={`student-starter-panel-link ${collapsed ? "is-collapsed-rail" : ""} ${linkIsActive(item.path.split("?")[0]) ? "active" : ""}`}
                    >
                      <span className="student-starter-panel-icon" aria-hidden="true">
                        {item.icon}
                      </span>
                      {collapsed ? (
                        <span className="lms-nav-underlabel">{item.short || item.label}</span>
                      ) : (
                        <span className="student-starter-panel-label">{item.label}</span>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
            )}



            <div className={`student-starter-panel student-starter-nav-top ${collapsed ? "collapsed" : ""}`}>
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
                    <span className="lms-nav-underlabel">Welcome</span>
                  </>
                ) : (
                  <>
                    <span className="lms-nav-link-main">
                      <span className="lms-nav-icon-wrap" aria-hidden="true">
                        <FiHome className="lms-nav-icon" />
                      </span>
                      <span>Welcome!</span>
                    </span>
                    <span className="student-starter-panel-more" aria-hidden="true">                   {showStarterMenu ? <FiChevronDown /> : <FiChevronRight />}                 </span>
                  </>
                )}
              </button>
              {showWelcomeMenu && (
                <div className="student-starter-panel-list">
                  {visibleWelcomeNavItems.map((item) => (
                    <NavLink
                      key={`welcome-nav-${item.path}`}
                      to={item.path}
                      title={collapsed ? item.label : undefined}
                      className={() =>
                        `student-starter-link ${linkIsActive(item.path.split("?")[0]) ? "active" : ""} ${collapsed ? "justify-content-center" : ""}`
                      }
                    >
                      <span className="student-starter-panel-icon" aria-hidden="true">{item.icon}</span>
                      {!collapsed && <span>{item.label}</span>}
                      {collapsed && <span className="visually-hidden">{item.label}</span>}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>

            <div className={`student-starter-panel student-starter-nav-top ${collapsed ? "collapsed" : ""}`}>
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
                    <span className="lms-nav-underlabel">Starter</span>
                  </>
                ) : (
                  <>
                    <span className="lms-nav-link-main">
                      <span className="lms-nav-icon-wrap" aria-hidden="true">
                        <FiGrid className="lms-nav-icon" />
                      </span>
                      <span>Sell It Starter</span>
                    </span>
                    <span className="student-starter-panel-more" aria-hidden="true">                   {showStarterMenu ? <FiChevronDown /> : <FiChevronRight />}                 </span>
                  </>
                )}
              </button>
              {showStarterMenu && (
                <div className="student-starter-panel-list">
                  {visibleStarterNavItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      title={collapsed ? item.label : undefined}
                      className={() =>
                        `student-starter-link ${linkIsActive(item.path) ? "active" : ""} ${collapsed ? "justify-content-center" : ""}`
                      }
                    >
                      <span className="student-starter-panel-icon" aria-hidden="true">{item.icon}</span>
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


            {navOn("community") && visibleCommunityNavItems.length > 0 && (
            <div className={`student-starter-panel  ${collapsed ? "collapsed" : ""}`}>
              <button
                type="button"
                className={`student-starter-panel-head ${isCommunityRouteActive ? "active" : ""} ${collapsed ? "lms-nav-link-collapsed collapsed" : ""}`}
                onClick={() => setCommunityMenuOpen((prev) => !prev)}
                title="Community"
                aria-expanded={showCommunityMenu}
              >
                {collapsed ? (
                  <>
                    <span className="lms-nav-icon-wrap" aria-hidden="true">
                      <FiUsers className="lms-nav-icon" />
                    </span>
                    <span className="lms-nav-underlabel">Community</span>
                    <span className="student-starter-panel-more is-collapsed-chevron" aria-hidden="true">
                      {showCommunityMenu ? <FiChevronDown /> : <FiChevronRight />}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="student-starter-panel-title">

                      <span>Community</span>
                    </span>
                    <span className="student-starter-panel-more" aria-hidden="true">
                      {showCommunityMenu ? <FiChevronDown /> : <FiChevronRight />}
                    </span>
                  </>
                )}
              </button>
              {showCommunityMenu && (
                <div className={`student-starter-panel-list ${collapsed ? "is-collapsed-rail" : ""}`}>
                  {visibleCommunityNavItems.map((item) => (
                    <NavLink
                      key={item.key}
                      to={item.path}
                      title={collapsed ? item.label : undefined}
                      className={() =>
                        `student-starter-panel-link ${
                          item.key === "sell" || item.path === "/dashboard/student-community"
                            ? "student-starter-panel-link--community-cta"
                            : ""
                        } ${collapsed ? "is-collapsed-rail" : ""} ${linkIsActive(item.path) ? "active" : ""}`
                      }
                    >
                      <span className="student-starter-panel-icon" aria-hidden="true">
                        {item.icon === "arrow" ? (
                          <span className="community-sidebar-ico-sell">➤</span>
                        ) : item.icon === "search" ? (
                          <FiSearch className="community-sidebar-fi" />
                        ) : (
                          item.icon
                        )}
                      </span>
                      {collapsed ? (
                        <span className="lms-nav-underlabel">{item.short || item.label}</span>
                      ) : (
                        <span className="flex-grow-1 text-truncate" style={{ minWidth: 0 }}>
                          {item.label}
                        </span>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
            )}
            {navOn("monthly_challenges") && (
            <div className={`student-starter-panel  ${collapsed ? "collapsed" : ""}`}>
              <button
                type="button"
                className={`student-starter-panel-head   ${isMonthlyChallengesNavActive ? "active" : ""} ${collapsed ? "lms-nav-link-collapsed collapsed" : ""}`}
                onClick={() => setMonthlyChallengesMenuOpen((prev) => !prev)}
                title="Monthly Challenges"
                aria-expanded={showMonthlyChallengesMenu}
              >
                {collapsed ? (
                  <>
                    <span className="lms-nav-icon-wrap" aria-hidden="true">
                      <FiCalendar className="lms-nav-icon" />
                    </span>
                    <span className="lms-nav-underlabel">Monthly</span>
                    <span className="student-starter-panel-more is-collapsed-chevron" aria-hidden="true">
                      {showMonthlyChallengesMenu ? <FiChevronDown /> : <FiChevronRight />}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="student-starter-panel-title">

                      <span>Monthly Challenges</span>
                    </span>
                    <span className="student-starter-panel-more" aria-hidden="true">                   {showMonthlyChallengesMenu ? <FiChevronDown /> : <FiChevronRight />}                 </span>
                  </>
                )}
              </button>
              {showMonthlyChallengesMenu && (
                <div className={`student-starter-panel-list ${collapsed ? "is-collapsed-rail" : ""}`}>
                  {monthlySidebar.loading ? (
                    <SidebarLinksSkeleton count={collapsed ? 2 : 4} />
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
                      const shortLabel = (displayTitleForMonthKey(key, monthlySidebar.labels) || line || key)
                        .replace(/^Monthly\s+/i, "")
                        .split(/\s+/)[0]
                        .slice(0, 8);
                      return (
                        <Link
                          key={`mc-month-${key}`}
                          to={`${STUDENT_MONTHLY_CHALLENGES_PATH}?month=${encodeURIComponent(key)}`}
                          title={tip}
                          className={`student-starter-panel-link ${collapsed ? "is-collapsed-rail" : ""} ${isMonthActive ? "active" : ""}`}
                        >
                          <span className="student-starter-panel-icon" aria-hidden="true">
                            {emoji}
                          </span>
                          {collapsed ? (
                            <span className="lms-nav-underlabel">{shortLabel}</span>
                          ) : (
                            <span className="text-truncate" style={{ maxWidth: "11.5rem" }}>
                              {line}
                            </span>
                          )}
                        </Link>
                      );
                    })
                  )}
                </div>
              )}
            </div>
            )}
            {navOn("join_us_live") && (
            <NavLink
              to="/dashboard/student-live-workshops"
              title={collapsed ? "Join Us LIVE" : undefined}
              className={() =>
                `lms-nav-link student-sidebar-live-link ${collapsed ? "lms-nav-link-collapsed" : ""} ${linkIsActive("/dashboard/student-live-workshops") ? "active" : ""}`
              }
            >
              <SidebarLinkLabel icon={FiAward} label="Join Us LIVE" short="Live" collapsed={collapsed} />
            </NavLink>
            )}
            {navOn("learning_center") && (
              <LearningCenterSidebarSection
                variant="student"
                collapsed={collapsed}
                navVisibility={navVisibility}
              />
            )}
            {!collapsed && navOn("links_contact") && (
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
              </>
            )}



          {!collapsed && (
            <div className="lms-sidebar-card">
              <p className="lms-sidebar-card-copy">A community for bigger thinkers.</p>
              <button type="button" className="lms-sidebar-card-cta">
                Let&apos;s Grow
                <FiChevronRight aria-hidden="true" />
              </button>
            </div>
          )}

          {navVisibilityReady && navOn("logout") && (
          <div className="lms-sidebar-footer">
            <button
              type="button"
              onClick={handleLogout}
              className={`lms-sidebar-logout ${collapsed ? "is-collapsed" : ""}`}
              title="Logout"
            >
              <FiLogOut aria-hidden="true" />
              <span className={collapsed ? "lms-nav-underlabel" : undefined}>Logout</span>
            </button>
          </div>
          )}
          </div>
        </aside>

        <div className={`flexss-fs p-3 p-sm-4 position-relative${collapsed ? " is-sidebar-collapsed" : ""}`}>
          <div className="student-panel-top-header mb-4">
            <label className="student-search-chip">
              <FiSearch className="student-search-icon" aria-hidden="true" />
              <input
                type="search"
                value={headerSearch}
                onChange={handleHeaderSearchChange}
                placeholder="Search people, posts, courses..."
                className="student-search-input"
                aria-label="Search people, posts, courses"
              />
            </label>
            <div className="student-panel-top-actions">
              <button
                type="button"
                className="student-icon-btn"
                aria-label="Toggle theme"
              >
                <FiSun />
              </button>
              <button
                type="button"
                className="student-icon-btn student-icon-btn--notify"
                aria-label="Notifications"
              >
                <FiBell />
                <span className="student-notify-dot" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="student-icon-btn"
                aria-label="Messages"
                onClick={() => {
                  setShowProfileMenu(false);
                  setShowBookmarkPanel(false);
                  setShowMessagePanel((prev) => !prev);
                }}
              >
                <FiMessageCircle />
              </button>
              <button
                type="button"
                className="student-icon-btn"
                aria-label="Bookmarks"
                onClick={() => {
                  setShowProfileMenu(false);
                  setShowMessagePanel(false);
                  setShowBookmarkPanel((prev) => !prev);
                }}
              >
                <FiBookmark />
              </button>

              <div className="student-profile-menu-wrap" ref={profileMenuRef}>
                <button
                  type="button"
                  className="student-profile-trigger"
                  aria-label="Profile"
                  aria-expanded={showProfileMenu}
                  aria-haspopup="menu"
                  onClick={() => {
                    setShowMessagePanel(false);
                    setShowBookmarkPanel(false);
                    setShowProfileMenu((prev) => !prev);
                  }}
                >
                  <span className="student-avatar-btn" aria-hidden="true">
                    {userInitial ? userInitial : <FiUser />}
                  </span>
                </button>
                {showProfileMenu && (
                  <div className="student-profile-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      className="student-profile-menu-item student-profile-menu-item--logout"
                      onClick={handleLogout}
                    >
                      <FiLogOut aria-hidden="true" />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
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
    </StudentHeaderSearchContext.Provider>
  );
}
