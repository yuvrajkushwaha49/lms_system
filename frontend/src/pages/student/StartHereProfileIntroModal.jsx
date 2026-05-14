import { useCallback, useEffect, useState } from "react";
import { FiBookmark, FiMaximize2, FiMoreHorizontal, FiX } from "react-icons/fi";
import { FaHeart } from "react-icons/fa";

function initial(name) {
  return String(name || "?")
    .trim()
    .charAt(0)
    .toUpperCase() || "?";
}

export default function StartHereProfileIntroModal({
  isOpen,
  onClose,
  likesCount,
  likedByMe,
  onToggleLike,
  recentLikers,
  onGoToAccountSettings,
}) {
  const [bookmarked, setBookmarked] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      queueMicrotask(() => setExpanded(false));
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const likers = Array.isArray(recentLikers) ? recentLikers : [];
  const displayLikers = likers.slice(0, 3);

  return (
    <div
      className={`start-here-profile-modal-backdrop${expanded ? " is-expanded" : ""}`}
      role="presentation"
      onMouseDown={handleBackdropClick}
    >
      <div
        className="start-here-profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-here-profile-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="start-here-profile-modal-head">
          <h2 id="start-here-profile-modal-title" className="start-here-profile-modal-title">
            Fill Out Your Profile
          </h2>
          <div className="start-here-profile-modal-actions">
            <button
              type="button"
              className="start-here-profile-modal-icon-btn"
              aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
              title="Bookmark"
              onClick={() => setBookmarked((v) => !v)}
            >
              <FiBookmark size={18} className={bookmarked ? "text-primary" : ""} style={bookmarked ? { fill: "currentColor" } : undefined} />
            </button>
            <button type="button" className="start-here-profile-modal-icon-btn" aria-label="More" title="More">
              <FiMoreHorizontal size={18} />
            </button>
            <button
              type="button"
              className="start-here-profile-modal-icon-btn"
              aria-label={expanded ? "Exit full screen" : "Expand"}
              title={expanded ? "Exit full screen" : "Expand"}
              onClick={() => setExpanded((v) => !v)}
            >
              <FiMaximize2 size={17} />
            </button>
            <button type="button" className="start-here-profile-modal-icon-btn" aria-label="Close" title="Close" onClick={onClose}>
              <FiX size={20} />
            </button>
          </div>
        </header>

        <div className="start-here-profile-modal-body">
          <p className="start-here-profile-modal-para">
            You can&apos;t attract opportunities if no one knows who you are! Your profile is your personal billboard, so make it count.
          </p>
          <p className="start-here-profile-modal-para">
            👉 Add your photo, your market, your wins, and what you&apos;re chasing. You never know who&apos;s looking to refer you next.
          </p>
          <div className="start-here-profile-modal-cta-wrap">
            <button type="button" className="start-here-profile-modal-cta" onClick={onGoToAccountSettings}>
              Fill Out Your Profile
            </button>
          </div>
        </div>

        <footer className="start-here-profile-modal-foot">
          <button
            type="button"
            className={`start-here-profile-modal-like${likedByMe ? " is-liked" : ""}`}
            onClick={onToggleLike}
            aria-pressed={likedByMe}
            aria-label={`Like. ${likesCount} likes.`}
          >
            <FaHeart size={16} aria-hidden />
          </button>
          <div className="start-here-profile-modal-foot-right">
            {displayLikers.length > 0 && (
              <div className="start-here-profile-modal-avatars" aria-hidden>
                {displayLikers.map((u, i) => (
                  <span
                    key={u.id || i}
                    className="start-here-profile-modal-avatar"
                    style={{ zIndex: 3 - i }}
                    title={u.name}
                  >
                    {initial(u.name)}
                  </span>
                ))}
              </div>
            )}
            <span className="start-here-profile-modal-likes-label">{likesCount} likes</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
