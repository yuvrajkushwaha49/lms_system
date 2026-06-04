import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { FiBriefcase, FiChevronDown, FiChevronRight, FiMoreHorizontal, FiZap } from "react-icons/fi";
import { STUDENT_MONTHLY_CHALLENGES_PATH } from "../utils/studentMonthlyChallengeMeta";

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

function learningRouteActive(variant, key, pathname, search) {
  if (variant === "student") {
    if (key === "short") return studentShortActive(pathname);
    if (key === "signature") return studentSignatureActive(pathname);
    if (key === "docs") return studentDocsActive(pathname);
  }
  if (key === "short") return adminShortActive(pathname, search);
  if (key === "signature") return adminSignatureActive(pathname, search);
  if (key === "docs") return adminDocsActive(pathname);
  return false;
}

function anyLearningActive(variant, pathname, search) {
  return ["short", "signature", "docs"].some((k) => learningRouteActive(variant, k, pathname, search));
}

const STUDENT_ITEMS = [
  {
    key: "short",
    label: "Sell It Short Courses",
    to: "/dashboard/student-sell-it-snacks",
    icon: "zap",
  },
  {
    key: "signature",
    label: "Signature Courses",
    to: "/dashboard/student-course",
    icon: "grad",
  },
  {
    key: "docs",
    label: "Documents & Templates",
    to: "/dashboard/student-document-center",
    icon: "briefcase",
  },
];

const ADMIN_ITEMS = [
  {
    key: "short",
    label: "Sell It Short Courses",
    to: "/dashboard/sell-it-snacks-management",
    icon: "zap",
  },
  {
    key: "signature",
    label: "Signature Courses",
    to: "/dashboard/course-management",
    icon: "grad",
  },
  {
    key: "docs",
    label: "Documents & Templates",
    to: "/dashboard/document-center-management",
    icon: "briefcase",
  },
];

export default function LearningCenterSidebarSection({ variant, collapsed }) {
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(variant === "admin");
  const [moreOpen, setMoreOpen] = useState(false);
  const moreWrapRef = useRef(null);

  const items = variant === "admin" ? ADMIN_ITEMS : STUDENT_ITEMS;
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
    return (
      <span className="lms-lc-icon lms-lc-icon--case" aria-hidden>
        <FiBriefcase />
      </span>
    );
  };

  if (collapsed) {
    return (
      <div className="lms-learning-center lms-learning-center--collapsed">
        <NavLink
          to={items[0].to}
          title="Learning Center"
          className={() => `lms-nav-link lms-nav-link-collapsed ${anyActive ? "active" : ""}`}
        >
          <span className="lms-nav-icon-wrap" aria-hidden>
            <FiZap className="lms-nav-icon" />
          </span>
          <span className="lms-nav-short">LC</span>
        </NavLink>
      </div>
    );
  }

  return (
    <div className="student-starter-panel  ">
        <button
          type="button"
          className="student-starter-panel-head  "
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="student-starter-panel-title">Learning Center</span>
          <span className="lms-learning-center-chevron" aria-hidden>
            {open ? <FiChevronDown /> : <FiChevronRight />}
          </span>
        </button>
       
  
      {open ? (
        <div className="student-starter-panel-list">
          {items.map((item) => {
            const active = learningRouteActive(variant, item.key, pathname, search);
            return (
              <NavLink
                key={item.key}
                to={item.to}
                className={() => `student-starter-panel-link      ${active ? "is-active" : ""}`}
              >
                {renderIcon(item.icon)}
                <span className="lms-learning-center-label">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
