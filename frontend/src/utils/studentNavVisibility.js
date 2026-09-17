/** Keep keys in sync with backend/controllers/studentNavVisibility.controller.js */

export const STUDENT_NAV_VISIBILITY_GROUPS = [
  {
    id: "main",
    label: "Main",
    items: [
      { key: "feed", label: "Feed" },
      { key: "join_us_live", label: "Join Us LIVE" },
      { key: "monthly_challenges", label: "Monthly Challenges" },
      { key: "links_contact", label: "Links — Contact Us" },
      { key: "logout", label: "Logout" },
    ],
  },
  {
    id: "starter",
    label: "Sell It Starter",
    items: [
      { key: "sell_it_starter", label: "Section (Sell It Starter)" },
      { key: "starter_start_here", label: "Start Here" },
      { key: "starter_live_workshops", label: "Live Workshops" },
      { key: "starter_sell_it_snacks", label: "Sell It Snacks" },
      { key: "starter_wall_of_wins", label: "Wall of Wins" },
      { key: "starter_faqs", label: "FAQs" },
    ],
  },
  {
    id: "welcome",
    label: "Welcome!",
    items: [
      { key: "welcome", label: "Section (Welcome!)" },
      { key: "welcome_start_here", label: "Start Here" },
      { key: "welcome_meet_greet", label: "Meet + Greet" },
      { key: "welcome_ask_ryan", label: "Ask Ryan Anything" },
      { key: "welcome_owning_manhattan", label: "Owning Manhattan" },
      { key: "welcome_community_input", label: "Community Input" },
      { key: "welcome_family_video", label: "Welcome to the Sell It family!" },
    ],
  },
  {
    id: "community",
    label: "Community",
    items: [
      { key: "community", label: "Section (Community)" },
      { key: "community_sell", label: "Sell It Community" },
      { key: "community_directory", label: "Member Directory" },
      { key: "community_referral", label: "Referral Partners" },
      { key: "community_listings", label: "Community Listings" },
      { key: "community_wall_of_wins", label: "Wall of Wins" },
    ],
  },
  {
    id: "learning",
    label: "Learning Center",
    items: [
      { key: "learning_center", label: "Section (Learning Center)" },
      { key: "learning_short_courses", label: "Sell It Short Courses" },
      { key: "learning_signature_courses", label: "Signature Courses" },
      { key: "learning_documents", label: "Documents & Templates" },
      { key: "learning_gallery", label: "Gallery" },
    ],
  },
  {
    id: "top",
    label: "Top header",
    items: [
      { key: "top_home", label: "Home" },
      { key: "top_courses", label: "Courses" },
      { key: "top_events", label: "Events" },
      { key: "top_owning_manhattan", label: "Owning Manhattan" },
      { key: "top_leaderboard", label: "Leaderboard" },
    ],
  },
];

export const STUDENT_NAV_VISIBILITY_KEYS = STUDENT_NAV_VISIBILITY_GROUPS.flatMap((g) =>
  g.items.map((item) => item.key),
);

export const defaultStudentNavVisibility = () =>
  STUDENT_NAV_VISIBILITY_KEYS.reduce((acc, key) => {
    acc[key] = true;
    return acc;
  }, {});

const NAV_VIS_CACHE_KEY = "student_nav_visibility_v1";
let navVisibilityMemoryCache = null;

export const mergeStudentNavVisibility = (incoming) => ({
  ...defaultStudentNavVisibility(),
  ...(incoming && typeof incoming === "object" ? incoming : {}),
});

export const readCachedStudentNavVisibility = () => {
  if (navVisibilityMemoryCache) return { ...navVisibilityMemoryCache };
  try {
    const raw = localStorage.getItem(NAV_VIS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const merged = mergeStudentNavVisibility(parsed);
    navVisibilityMemoryCache = merged;
    return { ...merged };
  } catch {
    return null;
  }
};

export const writeCachedStudentNavVisibility = (visibility) => {
  const merged = mergeStudentNavVisibility(visibility);
  navVisibilityMemoryCache = merged;
  try {
    localStorage.setItem(NAV_VIS_CACHE_KEY, JSON.stringify(merged));
  } catch {
    /* ignore quota */
  }
  return merged;
};

export const isNavVisible = (visibility, key) => {
  if (!visibility || typeof visibility !== "object") return true;
  if (!Object.prototype.hasOwnProperty.call(visibility, key)) return true;
  return Boolean(visibility[key]);
};

export const STARTER_NAV_KEY_BY_PATH = {
  "/dashboard/start-here-starter": "starter_start_here",
  "/dashboard/student-live-workshops": "starter_live_workshops",
  "/dashboard/student-sell-it-snacks": "starter_sell_it_snacks",
  "/dashboard/student-wall-of-wins": "starter_wall_of_wins",
  "/dashboard/student-faqs": "starter_faqs",
};

export const WELCOME_NAV_KEY_BY_PATH = {
  "/dashboard/student-start-here": "welcome_start_here",
  "/dashboard/student-meet-greet": "welcome_meet_greet",
  "/dashboard/student-ask-ryan": "welcome_ask_ryan",
  "/dashboard/student-owning-manhattan": "welcome_owning_manhattan",
  "/coming-soon": "welcome_community_input",
  "/dashboard/student-welcome-family": "welcome_family_video",
};

export const COMMUNITY_NAV_KEY_BY_ITEM = {
  sell: "community_sell",
  dir: "community_directory",
  ref: "community_referral",
  list: "community_listings",
  wow: "community_wall_of_wins",
};

export const LEARNING_NAV_KEY_BY_ITEM = {
  short: "learning_short_courses",
  signature: "learning_signature_courses",
  docs: "learning_documents",
  gallery: "learning_gallery",
};

export const TOP_NAV_KEY_BY_ITEM = {
  home: "top_home",
  courses: "top_courses",
  events: "top_events",
  "owning-manhattan": "top_owning_manhattan",
  leaderboard: "top_leaderboard",
};
