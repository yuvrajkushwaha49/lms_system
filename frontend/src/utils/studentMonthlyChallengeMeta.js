/** Shared helpers for student Monthly Challenges (sidebar + page). */

export const STUDENT_MONTHLY_CHALLENGES_PATH = "/dashboard/student-courses-by-month";

export function parseCourseCreatedAt(course) {
  const raw = course.created_at || course.createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function monthKeyFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabelFromKey(key) {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function buildMonthsMetaFromCourses(courses) {
  const map = new Map();
  (courses || []).forEach((course) => {
    const d = parseCourseCreatedAt(course);
    if (!d) return;
    const key = monthKeyFromDate(d);
    map.set(key, (map.get(key) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([key, count]) => {
      const [y, m] = key.split("-").map(Number);
      return { key, count, sort: y * 100 + m };
    })
    .sort((a, b) => b.sort - a.sort);
}

export function labelsArrayToMap(rows) {
  const acc = {};
  (rows || []).forEach((row) => {
    const k = String(row?.month_key || "").trim();
    const v = String(row?.display_name || "").trim();
    if (k && v) acc[k] = v;
  });
  return acc;
}

export function displayTitleForMonthKey(key, labelByKey) {
  const custom = String(labelByKey[key] || "").trim();
  if (custom) return custom;
  return monthLabelFromKey(key);
}

/** One line like "May | The Sell It Pipeline…" for sidebar (adds month prefix if title has no "|"). */
export function formatMonthlyChallengeLine(key, labelByKey) {
  const t = displayTitleForMonthKey(key, labelByKey).trim();
  if (/\|\s*/.test(t)) return t;
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return t;
  const monthWord = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long" });
  return `${monthWord} | ${t}`;
}
