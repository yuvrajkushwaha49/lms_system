const STORAGE_COLLAPSED = "student_dashboard_sidebar_collapsed";

/** Survives StudentDashboardSectionPage remounts between student routes. */
export const studentSidebarSession = {
  collapsed:
    typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_COLLAPSED) === "1" : false,
  starterMenuOpen: true,
  welcomeMenuOpen: true,
  communityMenuOpen: true,
  monthlyChallengesMenuOpen: true,
  scrollTop: 0,
  monthlySidebar: {
    loading: false,
    meta: [],
    labels: {},
    fetchedAt: 0,
  },
};

export const syncSidebarCollapsed = (collapsed) => {
  studentSidebarSession.collapsed = Boolean(collapsed);
  try {
    localStorage.setItem(STORAGE_COLLAPSED, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
};

export const syncMonthlySidebarCache = (next) => {
  studentSidebarSession.monthlySidebar = {
    loading: false,
    meta: Array.isArray(next?.meta) ? next.meta : [],
    labels: next?.labels && typeof next.labels === "object" ? next.labels : {},
    fetchedAt: Date.now(),
  };
  return studentSidebarSession.monthlySidebar;
};
