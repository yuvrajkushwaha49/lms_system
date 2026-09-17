import { useCallback, useEffect, useMemo, useState } from "react";
import { FiCheck, FiEye, FiEyeOff, FiSave } from "react-icons/fi";
import DashboardSectionPage from "./DashboardSectionPage";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import {
  STUDENT_NAV_VISIBILITY_GROUPS,
  defaultStudentNavVisibility,
  writeCachedStudentNavVisibility,
} from "../../utils/studentNavVisibility";

export default function StudentNavVisibilityPage() {
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const [visibility, setVisibility] = useState(defaultStudentNavVisibility);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiBaseUrl}/api/student-nav-visibility`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to load navbar settings.");
      }
      setVisibility({
        ...defaultStudentNavVisibility(),
        ...(payload.data?.visibility || {}),
      });
    } catch (e) {
      setError(e.message || "Unable to load navbar settings.");
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    load();
  }, [load]);

  const setKey = (key, value) => {
    setVisibility((prev) => ({ ...prev, [key]: value }));
    setNotice("");
  };

  const setGroup = (group, value) => {
    setVisibility((prev) => {
      const next = { ...prev };
      group.items.forEach((item) => {
        next[item.key] = value;
      });
      return next;
    });
    setNotice("");
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiBaseUrl}/api/student-nav-visibility`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ visibility }),
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to save navbar settings.");
      }
      setVisibility({
        ...defaultStudentNavVisibility(),
        ...(payload.data?.visibility || {}),
      });
      writeCachedStudentNavVisibility(payload.data?.visibility || visibility);
      setNotice("Student navbar visibility saved.");
    } catch (e) {
      setError(e.message || "Unable to save navbar settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardSectionPage title="Student Navbar Visibility">
      <div className="lms-card p-4 p-md-5">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
          <div>
            <h1 className="h4 fw-bold mb-1">Student Navbar Visibility</h1>
            <p className="text-muted mb-0">
              Choose which left sidebar and top header links students can see.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary d-inline-flex align-items-center gap-2"
            onClick={save}
            disabled={loading || saving}
          >
            <FiSave aria-hidden="true" />
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>

        {error ? <div className="alert alert-danger">{error}</div> : null}
        {notice ? (
          <div className="alert alert-success d-inline-flex align-items-center gap-2">
            <FiCheck aria-hidden="true" />
            {notice}
          </div>
        ) : null}

        {loading ? (
          <p className="text-muted mb-0">Loading settings…</p>
        ) : (
          <div className="d-grid gap-4">
            {STUDENT_NAV_VISIBILITY_GROUPS.map((group) => {
              const allOn = group.items.every((item) => visibility[item.key]);
              const allOff = group.items.every((item) => !visibility[item.key]);
              return (
                <section key={group.id} className="border rounded-3 p-3 p-md-4 bg-white">
                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                    <h2 className="h6 fw-bold mb-0">{group.label}</h2>
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-success"
                        onClick={() => setGroup(group, true)}
                        disabled={allOn}
                      >
                        Show all
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => setGroup(group, false)}
                        disabled={allOff}
                      >
                        Hide all
                      </button>
                    </div>
                  </div>
                  <div className="d-grid gap-2">
                    {group.items.map((item) => {
                      const on = Boolean(visibility[item.key]);
                      return (
                        <label
                          key={item.key}
                          className="d-flex align-items-center justify-content-between gap-3 border rounded-3 px-3 py-2 mb-0"
                          style={{ cursor: "pointer", background: on ? "#f0fdf4" : "#f8fafc" }}
                        >
                          <span className="d-inline-flex align-items-center gap-2 fw-semibold">
                            {on ? (
                              <FiEye className="text-success" aria-hidden="true" />
                            ) : (
                              <FiEyeOff className="text-muted" aria-hidden="true" />
                            )}
                            {item.label}
                          </span>
                          <input
                            type="checkbox"
                            className="form-check-input m-0"
                            checked={on}
                            onChange={(e) => setKey(item.key, e.target.checked)}
                            aria-label={`${item.label} visibility`}
                          />
                        </label>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </DashboardSectionPage>
  );
}
