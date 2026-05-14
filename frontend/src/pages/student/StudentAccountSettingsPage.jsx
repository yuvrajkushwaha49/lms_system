import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import StudentDashboardSectionPage from "./StudentDashboardSectionPage";

const STORAGE_EXTRAS = "lms_student_profile_extras_v1";

const defaultExtras = () => ({
  avatarDataUrl: "",
  timezone: "(GMT +05:30) Chennai",
  language: "English",
  headline: "",
  bio: "",
  location: "",
  company: "",
  website: "",
  yearsInRe: "",
  production12m: "",
  currentRole: "",
  goals: [],
  instagram: "",
  facebook: "",
  linkedin: "",
  youtube: "",
  threads: "",
  tiktok: "",
  xUrl: "",
});

const GOAL_OPTIONS = [
  { goalKey: "leads", label: "Generate more leads" },
  { goalKey: "listings", label: "Win more listings" },
  { goalKey: "systems", label: "Build better systems" },
  { goalKey: "productivity", label: "Increase productivity" },
];

export default function StudentAccountSettingsPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [extras, setExtras] = useState(defaultExtras);
  const [savedNotice, setSavedNotice] = useState("");

  const load = useCallback(() => {
    try {
      const rawUser = localStorage.getItem("user");
      const user = rawUser ? JSON.parse(rawUser) : {};
      setFullName(String(user.name || ""));
      setEmail(String(user.email || ""));
      setPhone(String(user.phone || ""));
      const rawX = localStorage.getItem(STORAGE_EXTRAS);
      if (rawX) {
        const parsed = JSON.parse(rawX);
        setExtras({ ...defaultExtras(), ...parsed });
      } else {
        setExtras(defaultExtras());
      }
    } catch {
      setExtras(defaultExtras());
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => load());
  }, [load]);

  const setExtra = useCallback((patch) => {
    setExtras((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleGoal = useCallback((key) => {
    setExtras((prev) => {
      const set = new Set(prev.goals || []);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return { ...prev, goals: [...set] };
    });
  }, []);

  const onPhotoChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      setExtra({ avatarDataUrl: String(reader.result || "") });
    };
    reader.readAsDataURL(file);
  }, [setExtra]);

  const removePhoto = useCallback(() => {
    setExtra({ avatarDataUrl: "" });
  }, [setExtra]);

  const save = useCallback(() => {
    try {
      const rawUser = localStorage.getItem("user");
      const user = rawUser ? JSON.parse(rawUser) : {};
      const nextUser = {
        ...user,
        name: fullName.trim() || user.name,
        email: email.trim() || user.email,
        phone: phone.trim() || user.phone,
      };
      localStorage.setItem("user", JSON.stringify(nextUser));
      localStorage.setItem(STORAGE_EXTRAS, JSON.stringify(extras));
      navigate("/dashboard/student-start-here");
    } catch {
      setSavedNotice("Could not save. Try again.");
    }
  }, [fullName, email, phone, extras, navigate]);

  const locationHint = useMemo(() => {
    const loc = String(extras.location || "").trim();
    if (!loc) return null;
    return `We've updated your location to ${loc} based on the details you previously entered. If this isn't accurate, feel free to modify it.`;
  }, [extras.location]);

  return (
    <StudentDashboardSectionPage title="Profile">
      <div className="student-account-settings-wrap container-fluid px-0" style={{ maxWidth: 720 }}>
        {savedNotice && <div className="alert alert-success py-2 mb-3">{savedNotice}</div>}

        <div className="student-account-settings-card lms-card p-4 p-md-5">
          <h1 className="h4 fw-bold text-dark mb-4">Profile</h1>

          <section className="student-account-settings-section mb-4">
            <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
              <div>
                <label className="form-label fw-semibold mb-1">Profile photo</label>
                <p className="text-muted small mb-2">Recommended size: 300 × 300</p>
                <div className="d-flex gap-2">
                  <label className="btn btn-outline-secondary btn-sm rounded-pill px-3 mb-0">
                    Change
                    <input type="file" accept="image/*" className="d-none" onChange={onPhotoChange} />
                  </label>
                  <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill px-3" onClick={removePhoto}>
                    Remove
                  </button>
                </div>
              </div>
              <div className="student-account-settings-photo-preview">
                {extras.avatarDataUrl ? (
                  <img src={extras.avatarDataUrl} alt="" className="rounded-circle" width={88} height={88} />
                ) : (
                  <span className="student-account-settings-photo-placeholder rounded-circle">
                    {String(fullName || "U").trim().charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </section>

          <div className="row g-3">
            <div className="col-12">
              <label className="form-label">
                Full name<span className="text-danger">*</span>
              </label>
              <input className="form-control" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
            </div>
            <div className="col-md-6">
              <label className="form-label">
                Timezone<span className="text-danger">*</span>
              </label>
              <select className="form-select" value={extras.timezone} onChange={(e) => setExtra({ timezone: e.target.value })}>
                <option value="(GMT +05:30) Chennai">(GMT +05:30) Chennai</option>
                <option value="(GMT +00:00) London">(GMT +00:00) London</option>
                <option value="(GMT -05:00) New York">(GMT -05:00) New York</option>
                <option value="(GMT -08:00) Los Angeles">(GMT -08:00) Los Angeles</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label">
                Language<span className="text-danger">*</span>
              </label>
              <select className="form-select" value={extras.language} onChange={(e) => setExtra({ language: e.target.value })}>
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
              </select>
            </div>
            <div className="col-12">
              <label className="form-label">Phone Number</label>
              <input
                className="form-control"
                placeholder="XXX-XXX-XXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
            </div>
            <div className="col-12">
              <label className="form-label">Headline</label>
              <input
                className="form-control"
                placeholder="Founder at …"
                value={extras.headline}
                onChange={(e) => setExtra({ headline: e.target.value })}
              />
            </div>
            <div className="col-12">
              <label className="form-label">Bio</label>
              <textarea className="form-control" rows={4} value={extras.bio} onChange={(e) => setExtra({ bio: e.target.value })} />
            </div>
            <div className="col-12">
              <label className="form-label">
                Location<span className="text-danger">*</span>
              </label>
              <input className="form-control" value={extras.location} onChange={(e) => setExtra({ location: e.target.value })} />
              {locationHint && (
                <div className="alert alert-light border mt-2 mb-0 py-2 small text-secondary d-flex gap-2 align-items-start">
                  <span aria-hidden>ℹ️</span>
                  <span>{locationHint}</span>
                </div>
              )}
            </div>
            <div className="col-12">
              <label className="form-label">Company</label>
              <input className="form-control" value={extras.company} onChange={(e) => setExtra({ company: e.target.value })} />
            </div>
            <div className="col-12">
              <label className="form-label">Website</label>
              <input
                className="form-control"
                placeholder="https://"
                value={extras.website}
                onChange={(e) => setExtra({ website: e.target.value })}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">How many years have you been in RE?</label>
              <select className="form-select" value={extras.yearsInRe} onChange={(e) => setExtra({ yearsInRe: e.target.value })}>
                <option value="">Select</option>
                <option value="0-1">0–1 years</option>
                <option value="1-3">1–3 years</option>
                <option value="3-5">3–5 years</option>
                <option value="5-10">5–10 years</option>
                <option value="10+">10+ years</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label">How much production in the last 12 months?</label>
              <select className="form-select" value={extras.production12m} onChange={(e) => setExtra({ production12m: e.target.value })}>
                <option value="">Select</option>
                <option value="0-1M">0–1M</option>
                <option value="1M-5M">1M–5M</option>
                <option value="5M-10M">5M–10M</option>
                <option value="10M-20M">10M–20M</option>
                <option value="20M+">20M+</option>
              </select>
            </div>
            <div className="col-12">
              <label className="form-label">Which best describes your current role?</label>
              <select className="form-select" value={extras.currentRole} onChange={(e) => setExtra({ currentRole: e.target.value })}>
                <option value="">Select</option>
                <option value="broker_owner">I am a Broker Owner</option>
                <option value="agent">I am an Agent</option>
                <option value="team_lead">I am a Team Lead</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <section className="mt-4 mb-2">
            <label className="form-label fw-semibold">What are your top 3 goals for this year?</label>
            <div className="d-flex flex-column gap-2 mt-2">
              {GOAL_OPTIONS.map(({ goalKey, label }) => (
                <label key={goalKey} className="d-flex align-items-center gap-2 mb-0">
                  <input type="checkbox" checked={extras.goals?.includes(goalKey)} onChange={() => toggleGoal(goalKey)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </section>

          <hr className="my-4" />
          <h2 className="h6 fw-bold text-secondary text-uppercase small mb-3">Social</h2>
          <div className="row g-3">
            {[
              ["instagram", "Instagram", "https://www.instagram.com/…"],
              ["facebook", "Facebook", "Add your Facebook URL"],
              ["linkedin", "LinkedIn", "https://www.linkedin.com/in/…"],
              ["youtube", "YouTube", "Add your YouTube URL"],
              ["threads", "Threads", "Add your Threads URL"],
              ["tiktok", "TikTok", "Add your TikTok URL"],
              ["xUrl", "X", "Add your X URL"],
            ].map(([field, label, ph]) => (
              <div className="col-12" key={field}>
                <label className="form-label">{label}</label>
                <input
                  className="form-control"
                  placeholder={ph}
                  value={extras[field] || ""}
                  onChange={(e) => setExtra({ [field]: e.target.value })}
                />
              </div>
            ))}
          </div>

          <div className="student-account-settings-footer d-flex flex-wrap gap-2 justify-content-end mt-4 pt-3 border-top">
            <button type="button" className="btn btn-outline-secondary rounded-pill px-4" onClick={() => navigate("/dashboard/student-start-here")}>
              Cancel
            </button>
            <button type="button" className="btn btn-dark rounded-pill px-4" onClick={save}>
              Save changes
            </button>
          </div>
        </div>
      </div>
    </StudentDashboardSectionPage>
  );
}
