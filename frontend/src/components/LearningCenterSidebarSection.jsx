import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { FiBriefcase, FiChevronDown, FiChevronRight, FiImage, FiMoreHorizontal, FiZap } from "react-icons/fi";
import { STUDENT_MONTHLY_CHALLENGES_PATH } from "../utils/studentMonthlyChallengeMeta";

import { LEARNING_NAV_KEY_BY_ITEM, isNavVisible } from "../utils/studentNavVisibility";

function studentShortActive(pathname) {
  return pathname.startsWith("/dashboard/student-sell-it-snacks");
}

function studentSignatureActive(pathname) {
  if (pathname.startsWith(STUDENT_MONTHLY_CHALLENGES_PATH)) return false;
  return pathname === "/dashboard/student-course" || pathname.startsWith("/dashboard/student-course/");
}

function studentDocsActive(pathname) {
  return pathname.startsWith("/dashboard/student-document-center");
}

function studentGalleryActive(pathname) {
  return pathname.startsWith("/dashboard/student-gallery");
}

function adminShortActive(pathname, search) {
  if (pathname.startsWith("/dashboard/sell-it-snacks-management")) return true;
  const type = new URLSearchParams(search).get("type") || "";
  return pathname.startsWith("/dashboard/course-management") && type === "short-courses";
}

function adminSignatureActive(pathname, search) {
  const type = new URLSearchParams(search).get("type") || "";
  if (pathname.startsWith("/dashboard/owning-manhattan")) return false;
  if (!pathname.startsWith("/dashboard/course-management")) return false;
  if (type === "short-courses") return false;
  return true;
}

function adminDocsActive(pathname) {
  return pathname.startsWith("/dashboard/document-center-management");
}

function adminGalleryActive(pathname) {
  return pathname.startsWith("/dashboard/gallery-management");
}

function learningRouteActive(variant, key, pathname, search) {
  if (variant === "student") {
    if (key === "short") return studentShortActive(pathname);
    if (key === "signature") return studentSignatureActive(pathname);
    if (key === "docs") return studentDocsActive(pathname);
    if (key === "gallery") return studentGalleryActive(pathname);
  }
  if (key === "short") return adminShortActive(pathname, search);
  if (key === "signature") return adminSignatureActive(pathname, search);
  if (key === "docs") return adminDocsActive(pathname);
  if (key === "gallery") return adminGalleryActive(pathname);
  return false;
}

function anyLearningActive(variant, pathname, search) {
  return ["short", "signature", "docs", "gallery"].some((k) => learningRouteActive(variant, k, pathname, search));
}

const STUDENT_ITEMS = [
  {
    key: "short",
    label: "Sell It Short Courses",
    short: "Short",
    to: "/dashboard/student-sell-it-snacks",
    icon: "zap",
  },
  {
    key: "signature",
    label: "Signature Courses",
    short: "Courses",
    to: "/dashboard/student-course",
    icon: "grad",
  },
  {
    key: "docs",
    label: "Documents & Templates",
    short: "Docs",
    to: "/dashboard/student-document-center",
    icon: "briefcase",
  },
  {
    key: "gallery",
    label: "Gallery",
    short: "Gallery",
    to: "/dashboard/student-gallery",
    icon: "gallery",
  },
];

const ADMIN_ITEMS = [
  {
    key: "short",
    label: "Sell It Short Courses",
    short: "Short",
    to: "/dashboard/sell-it-snacks-management",
    icon: "zap",
  },
  {
    key: "signature",
    label: "Signature Courses",
    short: "Courses",
    to: "/dashboard/course-management",
    icon: "grad",
  },
  {
    key: "docs",
    label: "Documents & Templates",
    short: "Docs",
    to: "/dashboard/document-center-management",
    icon: "briefcase",
  },
  {
    key: "gallery",
    label: "Gallery Management",
    short: "Gallery",
    to: "/dashboard/gallery-management",
    icon: "gallery",
  },
];

export default function LearningCenterSidebarSection({ variant, collapsed, navVisibility }) {
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreWrapRef = useRef(null);

  const items = (variant === "admin" ? ADMIN_ITEMS : STUDENT_ITEMS).filter((item) => {
    if (variant !== "student") return true;
    const key = LEARNING_NAV_KEY_BY_ITEM[item.key];
    return key ? isNavVisible(navVisibility, key) : true;
  });
  const helpTo = variant === "admin" ? "/dashboard/faqs-management" : "/dashboard/student-faqs";
  const anyActive = anyLearningActive(variant, pathname, search);

  useEffect(() => {
    if (anyActive) setOpen(true);
  }, [anyActive]);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const onDown = (e) => {
      if (!moreWrapRef.current?.contains(e.target)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreOpen]);

  const renderIcon = (icon) => {
    if (icon === "zap") {
      return (
        <span className="lms-lc-icon lms-lc-icon--zap" aria-hidden>
          <FiZap />
        </span>
      );
    }
    if (icon === "grad") {
      return (
        <span className="lms-lc-icon lms-lc-icon--grad" aria-hidden>
          🎓
        </span>
      );
    }
    if (icon === "gallery") {
      return (
        <span className="lms-lc-icon lms-lc-icon--gallery" aria-hidden>
          <FiImage />
        </span>
      );
    }
    return (
      <span className="lms-lc-icon lms-lc-icon--case" aria-hidden>
        <FiBriefcase />
      </span>
    );
  };

  if (variant === "student" && items.length === 0) return null;

  return (
    <div className={`student-starter-panel ${collapsed ? "collapsed" : ""}`}>
      <button
        type="button"
        className={`student-starter-panel-head ${anyActive ? "active" : ""} ${collapsed ? "lms-nav-link-collapsed collapsed" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title="Learning Center"
        aria-expanded={open}
      >
        {collapsed ? (
          <>
            <span className="lms-nav-icon-wrap" aria-hidden>
              <FiZap className="lms-nav-icon" />
            </span>
            <span className="lms-nav-underlabel">Learning</span>
            <span className="student-starter-panel-more is-collapsed-chevron" aria-hidden>
              {open ? <FiChevronDown /> : <FiChevronRight />}
            </span>
          </>
        ) : (
          <>
            <span className="student-starter-panel-title">Learning Center</span>
            <span className="lms-learning-center-chevron" aria-hidden>
              {open ? <FiChevronDown /> : <FiChevronRight />}
            </span>
          </>
        )}
      </button>

      {open && items.length > 0 ? (
        <div className={`student-starter-panel-list ${collapsed ? "is-collapsed-rail" : ""}`}>
          {items.map((item) => {
            const active = learningRouteActive(variant, item.key, pathname, search);
            return (
              <NavLink
                key={item.key}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={() =>
                  `student-starter-panel-link ${collapsed ? "is-collapsed-rail" : ""} ${active ? "is-active active" : ""}`
                }
              >
                {renderIcon(item.icon)}
                {collapsed ? (
                  <span className="lms-nav-underlabel">{item.short || item.label}</span>
                ) : (
                  <span className="lms-learning-center-label">{item.label}</span>
                )}
              </NavLink>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
