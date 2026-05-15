import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

import {
  FiCalendar,
  FiCheck,
  FiFlag,
  FiMoreHorizontal,
  FiPlayCircle,
  FiSmartphone,
  FiUser,
} from "react-icons/fi";
import { FaHandshake, FaHeart } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import StartHereProfileIntroModal from "./StartHereProfileIntroModal";
import StartHereIntroduceModal from "./StartHereIntroduceModal";

const STEPS = [
  { key: "profile", step: 1, title: "Fill Out Your Profile", Icon: FiUser },
  { key: "introduce", step: 2, title: "Introduce Yourself", Icon: FaHandshake },
  { key: "notifications", step: 3, title: "Update Your Notifications", Icon: FiFlag },
  { key: "app", step: 4, title: "Download the App", Icon: FiSmartphone },
  {
    key: "event",
    step: 5,
    title: "RSVP for an Event and Subscribe to the Live Calendar",
    Icon: FiCalendar,
  },
  { key: "course", step: 6, title: "Pick a Course and Press Play", Icon: FiPlayCircle },
];

const STUDENT_PATHS = {
  profile: "/dashboard/student-account-settings",
  introduce: "/dashboard/student-meet-greet",
  notifications: "/dashboard/student-message",
  app: "#",
  event: "/dashboard/student-live-workshops",
  course: null,
};

const TRAINER_PATHS = {
  profile: "/dashboard/trainer-dashboard",
  introduce: "/dashboard/trainer-feed",
  notifications: "/dashboard/trainer-chat-support",
  app: "#",
  event: "/dashboard/trainer-course",
  course: null,
};

const defaultLike = () => ({ likes_count: 0, liked_by_me: false, recent_likers: [] });

export default function StartHereSixSteps({ variant = "student", onPickCourse }) {
  const navigate = useNavigate();
  const paths = variant === "trainer" ? TRAINER_PATHS : STUDENT_PATHS;

  const apiBaseUrl = useMemo(
    () => getApiBaseUrl(),
    [],
  );

  const [likesByKey, setLikesByKey] = useState({});
  const [likesLoaded, setLikesLoaded] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [introduceModalOpen, setIntroduceModalOpen] = useState(false);

  const reloadStats = useCallback(async () => {
    const applyFallback = () => {
      const next = {};
      STEPS.forEach(({ key }) => {
        next[key] = defaultLike();
      });
      setLikesByKey(next);
    };

    const token = localStorage.getItem("token");
    if (!token) {
      applyFallback();
      setLikesLoaded(true);
      return;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/api/start-here-steps/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to load likes.");
      }
      const steps = payload.data?.steps || {};
      const next = {};
      STEPS.forEach(({ key }) => {
        const row = steps[key];
        next[key] = {
          likes_count: Number(row?.likes_count ?? 0),
          liked_by_me: Boolean(row?.liked_by_me),
          recent_likers: Array.isArray(row?.recent_likers) ? row.recent_likers : [],
        };
      });
      setLikesByKey(next);
    } catch {
      applyFallback();
    } finally {
      setLikesLoaded(true);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    queueMicrotask(() => {
      void reloadStats();
    });
  }, [reloadStats]);

  const handleStep = useCallback(
    (key) => {
      if (variant === "student" && key === "profile") {
        setProfileModalOpen(true);
        return;
      }
      if (variant === "student" && key === "introduce") {
        setIntroduceModalOpen(true);
        return;
      }
      if (key === "course") {
        if (typeof onPickCourse === "function") onPickCourse();
        return;
      }
      const path = paths[key];
      if (path && path !== "#") navigate(path);
    },
    [navigate, onPickCourse, paths, variant],
  );

  const toggleLike = useCallback(
    async (key, event) => {
      event?.stopPropagation();
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const response = await fetch(`${apiBaseUrl}/api/start-here-steps/${encodeURIComponent(key)}/toggle-like`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== "success") {
          throw new Error(payload.message || "Unable to update like.");
        }
        await reloadStats();
      } catch {
        /* ignore */
      }
    },
    [apiBaseUrl, reloadStats],
  );

  const onNavKeyDown = useCallback(
    (e, key) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      handleStep(key);
    },
    [handleStep],
  );

  const likeFor = (key) => likesByKey[key] ?? defaultLike();

  const profileStats = likeFor("profile");
  const introduceStats = likeFor("introduce");

  return (
    <section
      className={`start-here-steps-section${variant === "student" ? " start-here-steps-section--student" : ""}`}
      aria-label="Getting started steps"
    >
      {variant === "student" && (
        <StartHereProfileIntroModal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          likesCount={profileStats.likes_count}
          likedByMe={profileStats.liked_by_me}
          onToggleLike={() => toggleLike("profile")}
          recentLikers={profileStats.recent_likers}
          onGoToAccountSettings={() => {
            setProfileModalOpen(false);
            navigate("/dashboard/student-account-settings");
          }}
        />
      )}
      {variant === "student" && (
        <StartHereIntroduceModal
          isOpen={introduceModalOpen}
          onClose={() => setIntroduceModalOpen(false)}
          likesCount={introduceStats.likes_count}
          likedByMe={introduceStats.liked_by_me}
          onToggleLike={() => toggleLike("introduce")}
          recentLikers={introduceStats.recent_likers}
          onGoToMeetGreet={() => {
            setIntroduceModalOpen(false);
            navigate("/dashboard/student-meet-greet");
          }}
        />
      )}

      <header className="start-here-steps-intro">
        <p className="start-here-steps-kicker">Sell It Starter</p>
        <h2 className="start-here-steps-heading">Your first steps</h2>
        <p className="start-here-steps-sub">
          Tap a card to go to that part of the community. Use the heart if a step helped you — it is just for encouragement.
        </p>
      </header>
      <div className="start-here-steps-grid">
        {STEPS.map((stepDef) => {
          const { key, step, title } = stepDef;
          const { likes_count: likesCount, liked_by_me: likedByMe } = likeFor(key);
          const iconSize = key === "introduce" ? 26 : 27;
          const iconNode =
            key === "event" ? (
              <span className="start-here-step-icon-stack">
                <FiCalendar size={26} strokeWidth={2} />
                <FiCheck className="start-here-step-cal-check" size={11} strokeWidth={3} aria-hidden />
              </span>
            ) : (
              createElement(stepDef.Icon, { size: iconSize })
            );
          return (
            <div key={key} className="start-here-step-card">
              <div
                className="start-here-step-card-nav"
                role="button"
                tabIndex={0}
                onClick={() => handleStep(key)}
                onKeyDown={(e) => onNavKeyDown(e, key)}
                aria-label={`${title}, step ${step}. Open.`}
              >
                <div className="start-here-step-card-top">
                  <span className="start-here-step-dots" aria-hidden="true">
                    <FiMoreHorizontal size={20} strokeWidth={2.25} />
                  </span>
                  <div className="start-here-step-head-row">
                    <span className="start-here-step-label">STEP {step}</span>
                    <span className="start-here-step-icon-wrap" aria-hidden="true">
                      {iconNode}
                    </span>
                  </div>
                </div>
                <div className="start-here-step-card-body">
                  <h3 className="start-here-step-title">{title}</h3>
                </div>
              </div>
              <div className="start-here-step-meta-row">
                <button
                  type="button"
                  className={`start-here-step-like-btn${likedByMe ? " is-liked" : ""}`}
                  onClick={(e) => toggleLike(key, e)}
                  aria-pressed={likedByMe}
                  aria-label={`Like this step. ${likesCount} likes.`}
                >
                  <FaHeart className="start-here-step-heart" size={13} aria-hidden />
                  <span className="start-here-step-count">{likesLoaded ? likesCount : "…"}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
