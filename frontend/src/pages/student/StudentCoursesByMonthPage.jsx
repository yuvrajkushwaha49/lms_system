import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

import { useNavigate, useSearchParams } from "react-router-dom";
import StudentDashboardSectionPage from "./StudentDashboardSectionPage";
import StudentPageSearchSync from "../../components/StudentPageSearchSync";
import { resolvePublicMediaUrl } from "../../utils/mediaUrl";
import {
  buildMonthsMetaFromCourses,
  displayTitleForMonthKey,
  labelsArrayToMap,
  monthKeyFromDate,
  parseCourseCreatedAt,
} from "../../utils/studentMonthlyChallengeMeta";

/** Week 1 = days 1–7, Week 2 = 8–14, … of the calendar month */
const weekBucketInMonth = (d) => Math.min(5, Math.ceil(d.getDate() / 7));

const weekRangeLabel = (weekIndex, monthDate) => {
  const y = monthDate.getFullYear();
  const mo = monthDate.getMonth();
  const startDay = (weekIndex - 1) * 7 + 1;
  const endDay = Math.min(weekIndex * 7, new Date(y, mo + 1, 0).getDate());
  const start = new Date(y, mo, startDay);
  const end = new Date(y, mo, endDay);
  const fmt = (dt) =>
    dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)}–${fmt(end)}`;
};

const flattenScheduleCourses = (weeks) => {
  if (!weeks) return [];
  const list = [];
  for (let w = 1; w <= 5; w += 1) {
    (weeks[w] || []).forEach((row) => {
      const { monthly_challenge: _mc, ...course } = row;
      list.push(course);
    });
  }
  return list;
};

const buildWeekSectionsFromSchedule = (weeks, selectedMonthDate) => {
  if (!weeks || !selectedMonthDate) return [];
  const sections = [];
  for (let weekIndex = 1; weekIndex <= 5; weekIndex += 1) {
    const rows = weeks[weekIndex] || [];
    if (!rows.length) continue;
    const list = rows.map((row) => {
      const { monthly_challenge: _mc, ...course } = row;
      return course;
    });
    sections.push({
      weekIndex,
      list,
      range: weekRangeLabel(weekIndex, selectedMonthDate),
    });
  }
  return sections;
};

export default function StudentCoursesByMonthPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const monthParam = searchParams.get("month");

  const [courses, setCourses] = useState([]);
  const [monthLabelByKey, setMonthLabelByKey] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [openWeeks, setOpenWeeks] = useState(() => new Set([1, 2, 3, 4, 5]));
  const [thumbByCourseId, setThumbByCourseId] = useState({});
  const [schedule, setSchedule] = useState(null);
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
  const [headerMonthSearch, setHeaderMonthSearch] = useState("");

  const apiBaseUrl = useMemo(
    () => getApiBaseUrl(),
    [],
  );

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Session missing. Please login first.");
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        setError("");
        const [coursesRes, labelsRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/courses`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${apiBaseUrl}/api/monthly-challenge-months`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        const coursesPayload = await coursesRes.json();
        if (!coursesRes.ok || coursesPayload.status !== "success") {
          throw new Error(coursesPayload.message || "Unable to fetch courses");
        }
        if (!cancelled) setCourses(Array.isArray(coursesPayload.data) ? coursesPayload.data : []);

        let labelMap = {};
        if (labelsRes.ok) {
          const labelsPayload = await labelsRes.json();
          if (labelsPayload.status === "success" && Array.isArray(labelsPayload.data)) {
            labelMap = labelsArrayToMap(labelsPayload.data);
          }
        }
        if (!cancelled) setMonthLabelByKey(labelMap);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load courses");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  const monthsMeta = useMemo(() => buildMonthsMetaFromCourses(courses), [courses]);

  const selectedMonthKey = useMemo(() => {
    if (!monthsMeta.length) return null;
    const keys = new Set(monthsMeta.map((m) => m.key));
    if (monthParam && keys.has(monthParam)) return monthParam;
    return monthsMeta[0].key;
  }, [monthsMeta, monthParam]);

  useEffect(() => {
    if (!monthsMeta.length || !selectedMonthKey) return;
    if (monthParam !== selectedMonthKey) {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("month", selectedMonthKey);
          return n;
        },
        { replace: true },
      );
    }
  }, [monthsMeta, monthParam, selectedMonthKey, setSearchParams]);

  useEffect(() => {
    if (monthParam) setOpenWeeks(new Set([1, 2, 3, 4, 5]));
  }, [monthParam]);

  useEffect(() => {
    if (!selectedMonthKey) return undefined;
    const token = localStorage.getItem("token");
    if (!token) return undefined;
    let cancelled = false;
    setSchedule(null);
    setScheduleLoaded(false);
    (async () => {
      try {
        const res = await fetch(
          `${apiBaseUrl}/api/monthly-challenge-months/${encodeURIComponent(selectedMonthKey)}/schedule`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const payload = await res.json();
        if (cancelled) return;
        if (res.ok && payload.status === "success" && payload.data?.weeks) {
          setSchedule(payload.data);
        } else {
          setSchedule(null);
        }
      } catch {
        if (!cancelled) setSchedule(null);
      } finally {
        if (!cancelled) setScheduleLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedMonthKey, apiBaseUrl]);

  const selectedMonthDate = useMemo(() => {
    if (!selectedMonthKey) return null;
    const [y, m] = selectedMonthKey.split("-").map(Number);
    if (!y || !m) return null;
    return new Date(y, m - 1, 1);
  }, [selectedMonthKey]);

  const coursesInSelectedMonth = useMemo(() => {
    if (!selectedMonthKey) return [];
    return courses.filter((course) => {
      const d = parseCourseCreatedAt(course);
      if (!d) return false;
      return monthKeyFromDate(d) === selectedMonthKey;
    });
  }, [courses, selectedMonthKey]);

  const legacyWeekSections = useMemo(() => {
    const buckets = new Map();
    coursesInSelectedMonth.forEach((course) => {
      const d = parseCourseCreatedAt(course);
      if (!d) return;
      const w = weekBucketInMonth(d);
      if (!buckets.has(w)) buckets.set(w, []);
      buckets.get(w).push(course);
    });
    const weeks = Array.from(buckets.keys()).sort((a, b) => a - b);
    return weeks.map((weekIndex) => {
      const list = (buckets.get(weekIndex) || []).sort((a, b) => {
        const da = parseCourseCreatedAt(a)?.getTime() || 0;
        const db = parseCourseCreatedAt(b)?.getTime() || 0;
        return db - da;
      });
      const range =
        selectedMonthDate != null ? weekRangeLabel(weekIndex, selectedMonthDate) : "";
      return { weekIndex, list, range };
    });
  }, [coursesInSelectedMonth, selectedMonthDate]);

  const weekSections = useMemo(() => {
    if (!selectedMonthDate) return [];
    if (scheduleLoaded && schedule?.weeks) {
      return buildWeekSectionsFromSchedule(schedule.weeks, selectedMonthDate);
    }
    return legacyWeekSections;
  }, [schedule, scheduleLoaded, selectedMonthDate, legacyWeekSections]);

  const coursesForThumbs = useMemo(() => {
    if (scheduleLoaded && schedule?.weeks) {
      return flattenScheduleCourses(schedule.weeks);
    }
    return coursesInSelectedMonth;
  }, [schedule, scheduleLoaded, coursesInSelectedMonth]);

  useEffect(() => {
    if (!coursesForThumbs.length) {
      setThumbByCourseId({});
      return undefined;
    }
    const token = localStorage.getItem("token");
    if (!token) return undefined;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        coursesForThumbs.map(async (course) => {
          const id = course.id;
          if (id == null) return [String(id), ""];
          try {
            const res = await fetch(`${apiBaseUrl}/api/courses/${id}/videos`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const payload = await res.json();
            if (!res.ok || payload.status !== "success") return [String(id), ""];
            const list = Array.isArray(payload.data) ? payload.data : [];
            const v =
              list.find((row) => row.thumbnail_url || row.thumbnail_data_url) || list[0];
            const raw = v?.thumbnail_url || v?.thumbnail_data_url || "";
            return [String(id), resolvePublicMediaUrl(raw, apiBaseUrl)];
          } catch {
            return [String(id), ""];
          }
        }),
      );
      if (cancelled) return;
      const next = {};
      entries.forEach(([k, v]) => {
        if (k != null) next[k] = v;
      });
      setThumbByCourseId(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [coursesForThumbs, apiBaseUrl]);

  const filteredWeekSections = useMemo(() => {
    const query = headerMonthSearch.trim().toLowerCase();
    if (!query) return weekSections;
    return weekSections
      .map((section) => ({
        ...section,
        list: section.list.filter((course) => {
          const title = String(course.title || "").toLowerCase();
          const description = String(course.description || "").toLowerCase();
          return title.includes(query) || description.includes(query);
        }),
      }))
      .filter((section) => section.list.length > 0);
  }, [weekSections, headerMonthSearch]);

  const visibleCourseCount = useMemo(
    () => filteredWeekSections.reduce((n, s) => n + s.list.length, 0),
    [filteredWeekSections],
  );

  const toggleWeek = (weekIndex) => {
    setOpenWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekIndex)) next.delete(weekIndex);
      else next.add(weekIndex);
      return next;
    });
  };

  const collapseAllWeeks = () => setOpenWeeks(new Set());

  const expandAllWeeks = useCallback(() => setOpenWeeks(new Set([1, 2, 3, 4, 5])), []);

  const displayMonthTitle = useCallback(
    (key) => displayTitleForMonthKey(key, monthLabelByKey),
    [monthLabelByKey],
  );

  const formatPricing = (course) =>
    course.pricing_type || (Number(course.price) === 0 ? "Free for Members" : "Paid");

  return (
    <StudentDashboardSectionPage title="Monthly challenges">
      <StudentPageSearchSync onSearchChange={setHeaderMonthSearch} />
      <div className="container-fluid px-0 student-monthly-page" >
        <div className="lms-card overflow-hidden border-0 shadow-sm student-monthly-card">
          <div className="student-monthly-hero px-3 py-4 px-md-4 border-bottom">
            <p className="text-uppercase small text-white-50 fw-bold mb-2">Learning</p>
            <h1 className="h4 fw-bold text-white mb-2">Monthly challenges</h1>
            <p className="text-white-50 small mb-0 student-monthly-hero-copy">
              Pick a challenge month from the <strong className="text-white">sidebar</strong> under Monthly
              Challenges. Courses are grouped by week (admins can move or hide courses for each month). Titles can be customized in admin.
            </p>
          </div>

          {error ? <div className="alert alert-danger m-3 mb-0">{error}</div> : null}

          <div className="p-3 p-md-4 student-monthly-body">
            {isLoading ? (
              <p className="text-muted mb-0">Loading courses…</p>
            ) : !selectedMonthKey || !selectedMonthDate ? (
              <p className="text-muted mb-0">Choose a month in the left sidebar under Monthly Challenges.</p>
            ) : (
              <>
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
                  <div className="min-w-0">
                    <h2 className="h5 fw-bold text-dark mb-1 text-truncate">
                      {displayMonthTitle(selectedMonthKey)}
                    </h2>
                    <p className="text-muted small mb-0">
                      {visibleCourseCount} course
                      {visibleCourseCount === 1 ? "" : "s"}
                      <span className="text-muted opacity-50 mx-2">·</span>
                      {filteredWeekSections.length} week{filteredWeekSections.length === 1 ? "" : "s"} with uploads
                    </p>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-sm student-community-new-post rounded-pill px-3"
                      onClick={expandAllWeeks}
                    >
                      Expand all
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm rounded-pill px-3"
                      onClick={collapseAllWeeks}
                    >
                      Collapse all
                    </button>
                  </div>
                </div>

                {filteredWeekSections.length === 0 ? (
                  <p className="text-muted mb-0">No uploads in this month.</p>
                ) : (
                  <div className="student-monthly-week-stack d-flex flex-column gap-3">
                    {filteredWeekSections.map(({ weekIndex, list, range }) => {
                      const open = openWeeks.has(weekIndex);
                      return (
                        <div
                          key={weekIndex}
                          className={`student-monthly-week-v2 border rounded-4 overflow-hidden bg-white shadow-sm ${open ? "is-open" : ""}`}
                        >
                          <button
                            type="button"
                            className="student-monthly-week-head w-100 text-start border-0 d-flex align-items-center gap-3 px-3 py-3 px-md-4"
                            onClick={() => toggleWeek(weekIndex)}
                            aria-expanded={open}
                          >
                            <span className="student-monthly-week-pill flex-shrink-0">W{weekIndex}</span>
                            <span className="flex-grow-1 min-w-0">
                              <span className="d-block fw-semibold text-dark">Week {weekIndex}</span>
                              <span className="d-block small text-muted">{range}</span>
                            </span>
                            <span className="student-monthly-week-chevron flex-shrink-0 text-muted" aria-hidden>
                              {open ? "▾" : "▸"}
                            </span>
                          </button>
                          {open ? (
                            <div className="student-monthly-week-body border-top bg-light bg-opacity-50 px-3 py-3 px-md-4">
                              <ul className="list-unstyled mb-0 d-flex flex-column gap-3">
                                {list.map((course) => {
                                  const thumb = thumbByCourseId[String(course.id)] || "";
                                  const created = parseCourseCreatedAt(course);
                                  const dateStr = created
                                    ? created.toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      })
                                    : "—";
                                  return (
                                    <li key={course.id}>
                                      <button
                                        type="button"
                                        className="student-monthly-course-card w-100 text-start border-0 rounded-4 p-0 bg-white text-dark shadow-sm"
                                        onClick={() =>
                                          navigate(`/dashboard/student-course/${course.id}`)
                                        }
                                      >
                                        <div className="d-flex flex-column flex-sm-row gap-0 gap-sm-3">
                                          <div className="student-monthly-course-thumb-wrap flex-shrink-0">
                                            {thumb ? (
                                              <img
                                                src={thumb}
                                                alt=""
                                                className="student-monthly-course-thumb-img"
                                              />
                                            ) : (
                                              <div className="student-monthly-course-thumb-placeholder d-flex align-items-center justify-content-center h-100 small text-muted px-3 text-center">
                                                Image coming soon
                                              </div>
                                            )}
                                          </div>
                                          <div className="student-monthly-course-body p-3 p-sm-3 ps-sm-0 d-flex flex-column justify-content-center min-w-0 flex-grow-1">
                                            <p className="fw-semibold mb-1 mb-sm-2 student-monthly-course-title">
                                              {course.title || "Untitled course"}
                                            </p>
                                            <p className="small text-muted mb-2 mb-sm-3 student-monthly-course-desc">
                                              {course.description || "No description yet."}
                                            </p>
                                            <div className="d-flex flex-wrap align-items-center gap-2 mt-auto">
                                              <span className="badge rounded-pill student-monthly-badge-soft">
                                                {formatPricing(course)}
                                              </span>
                                              <span className="badge rounded-pill student-monthly-badge-type">
                                                {course.course_type || "Course"}
                                              </span>
                                              <span className="small text-muted ms-sm-auto">
                                                Uploaded {dateStr}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </StudentDashboardSectionPage>
  );
}
