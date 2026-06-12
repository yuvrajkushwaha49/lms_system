function range(count) {
  return Array.from({ length: count }, (_, i) => i);
}

export function SkeletonShine({ className = "", style, ...props }) {
  return <div className={`lms-skeleton-shine ${className}`.trim()} style={style} {...props} />;
}

export function SkeletonLine({ className = "", width, height = 12, style }) {
  return (
    <SkeletonShine
      className={`lms-skeleton-line ${className}`.trim()}
      style={{ width, height, ...style }}
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }) {
  return range(rows).map((i) => (
    <tr key={i} className="lms-skeleton-table-row" aria-hidden>
      {range(cols).map((j) => (
        <td key={j} className={j === 0 ? "ps-4" : j === cols - 1 ? "text-end pe-4" : ""}>
          <SkeletonLine width={j === 0 ? "72%" : j === cols - 1 ? 64 : "48%"} />
        </td>
      ))}
    </tr>
  ));
}

export function SidebarLinksSkeleton({ count = 4, className = "" }) {
  return (
    <div className={className} aria-busy="true" aria-hidden>
      {range(count).map((i) => (
        <div key={i} className="lms-skeleton-sidebar-link">
          <SkeletonLine width="78%" height={14} />
        </div>
      ))}
    </div>
  );
}

export function FaqListSkeleton({ count = 6 }) {
  return (
    <div className="lms-skeleton-faq-list" aria-busy="true" aria-label="Loading FAQs">
      {range(count).map((i) => (
        <div key={i} className="lms-skeleton-faq-item" aria-hidden>
          <SkeletonLine width={`${68 + (i % 3) * 8}%`} height={16} />
        </div>
      ))}
    </div>
  );
}

export function CommentListSkeleton({ count = 3 }) {
  return (
    <div className="lms-skeleton-comment-list" aria-busy="true" aria-label="Loading comments">
      {range(count).map((i) => (
        <div key={i} className="lms-skeleton-comment" aria-hidden>
          <div className="lms-skeleton-comment-head">
            <SkeletonShine className="lms-skeleton-avatar" />
            <div className="lms-skeleton-comment-meta">
              <SkeletonLine width={96} height={12} />
              <SkeletonLine width={64} height={10} />
            </div>
          </div>
          <SkeletonLine width="92%" />
          <SkeletonLine width="76%" />
        </div>
      ))}
    </div>
  );
}

export function ChatThreadSkeleton({ count = 4 }) {
  return (
    <div className="lms-skeleton-chat-thread" aria-busy="true" aria-label="Loading messages">
      {range(count).map((i) => (
        <div
          key={i}
          className={`lms-skeleton-chat-row${i % 2 === 1 ? " is-own" : ""}`}
          aria-hidden
        >
          <SkeletonShine className="lms-skeleton-chat-bubble" />
        </div>
      ))}
    </div>
  );
}

export function CourseHeroSkeleton({ variant = "dark" }) {
  const isDark = variant === "dark";
  return (
    <div
      className={`lms-skeleton-course-hero${isDark ? " lms-skeleton-course-hero--dark" : ""}`}
      aria-busy="true"
      aria-label="Loading course"
    >
      <SkeletonLine className="lms-skeleton-line--eyebrow" width={120} height={10} />
      <SkeletonLine className="lms-skeleton-line--title" width="48%" height={28} />
      <SkeletonLine width="72%" height={14} />
      <div className="lms-skeleton-badge-row">
        <SkeletonShine className="lms-skeleton-badge" />
        <SkeletonShine className="lms-skeleton-badge" />
        <SkeletonShine className="lms-skeleton-badge" />
      </div>
    </div>
  );
}

export function ProfileHeroSkeleton() {
  return (
    <div className="lms-card p-4 p-md-5 lms-skeleton-profile-hero" aria-busy="true" aria-label="Loading profile">
      <div className="d-flex align-items-start gap-3">
        <SkeletonShine className="lms-skeleton-profile-avatar" />
        <div className="flex-grow-1">
          <SkeletonLine width="38%" height={24} />
          <SkeletonLine width="52%" height={12} className="mt-2" />
          <SkeletonLine width="44%" height={12} className="mt-2" />
          <SkeletonLine width="28%" height={12} className="mt-3" />
        </div>
      </div>
    </div>
  );
}

export function OmEpisodeGridSkeleton({ count = 6 }) {
  return (
    <div className="student-om-grid" aria-busy="true" aria-label="Loading courses">
      {range(count).map((i) => (
        <div key={i} className="student-om-card student-om-card--skeleton" aria-hidden>
          <SkeletonShine className="student-om-card-media lms-skeleton-om-media" />
          <div className="student-om-card-body">
            <SkeletonLine width="84%" height={14} />
            <SkeletonLine width="56%" height={11} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function OmAdminCardGridSkeleton({ count = 6 }) {
  return (
    <div className="lms-om-admin-grid lms-om-admin-grid--premium" aria-busy="true" aria-label="Loading catalog">
      {range(count).map((i) => (
        <article key={i} className="lms-om-admin-card lms-om-admin-card--premium lms-om-admin-card--skeleton" aria-hidden>
          <div className="d-flex justify-content-between gap-2 mb-2">
            <SkeletonShine className="lms-skeleton-badge" />
            <SkeletonShine className="lms-skeleton-badge" />
          </div>
          <SkeletonLine width="78%" height={16} />
          <SkeletonLine width="92%" height={12} />
          <SkeletonShine className="lms-skeleton-om-preview" />
          <SkeletonLine width="40%" height={11} />
          <div className="lms-skeleton-badge-row">
            <SkeletonShine className="lms-skeleton-badge lms-skeleton-badge--sm" />
            <SkeletonShine className="lms-skeleton-badge lms-skeleton-badge--sm" />
          </div>
        </article>
      ))}
    </div>
  );
}

export function MonthlyWeekListSkeleton({ count = 3 }) {
  return (
    <div className="student-monthly-week-stack d-flex flex-column gap-3" aria-busy="true" aria-label="Loading courses">
      {range(count).map((i) => (
        <div key={i} className="student-monthly-week-v2 border rounded-4 overflow-hidden bg-white shadow-sm lms-skeleton-week" aria-hidden>
          <div className="student-monthly-week-head d-flex align-items-center gap-3 px-3 py-3 px-md-4">
            <SkeletonShine className="lms-skeleton-week-pill" />
            <div className="flex-grow-1">
              <SkeletonLine width={88} height={14} />
              <SkeletonLine width={120} height={11} className="mt-1" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AskRyanGridSkeleton({ count = 4 }) {
  return (
    <div className="ask-ryan-grid" aria-busy="true" aria-label="Loading responses">
      {range(count).map((i) => (
        <article key={i} className="ask-ryan-response-card lms-card lms-skeleton-ask-card" aria-hidden>
          <div className="ask-ryan-split">
            <div className="ask-ryan-split-q">
              <SkeletonLine width="70%" height={12} />
              <SkeletonLine width="90%" height={12} />
            </div>
            <SkeletonShine className="lms-skeleton-ask-video" />
          </div>
        </article>
      ))}
    </div>
  );
}

export function SnackVideoGridSkeleton({ count = 6 }) {
  return (
    <div className="sell-snacks-grid" aria-busy="true" aria-label="Loading videos">
      {range(count).map((i) => (
        <div key={i} className="sell-snack-card sell-snack-card--skeleton" aria-hidden>
          <SkeletonShine className="sell-snack-thumb lms-skeleton-snack-thumb" />
          <div className="sell-snack-body">
            <SkeletonLine width="72%" height={14} />
            <SkeletonLine width="48%" height={11} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminSnackListSkeleton({ count = 3 }) {
  return (
    <div className="row g-3" aria-busy="true" aria-label="Loading snacks">
      {range(count).map((i) => (
        <div key={i} className="col-md-6 col-xl-4" aria-hidden>
          <div className="border rounded-4 p-3 h-100 lms-skeleton-admin-snack">
            <div className="d-flex justify-content-between mb-2">
              <SkeletonShine className="lms-skeleton-badge lms-skeleton-badge--sm" />
              <SkeletonShine className="lms-skeleton-badge lms-skeleton-badge--sm" />
            </div>
            <SkeletonLine width="65%" height={16} />
            <SkeletonLine width="88%" height={12} />
            <SkeletonShine className="lms-skeleton-snack-video" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function WallOfWinsGridSkeleton({ count = 8 }) {
  return (
    <div className="wall-of-wins-grid" aria-busy="true" aria-label="Loading celebrations">
      {range(count).map((i) => (
        <article key={i} className="wall-of-wins-card-v2 wall-of-wins-card-v2--skeleton" aria-hidden>
          <SkeletonShine className="wall-of-wins-card-media lms-skeleton-wow-media" />
          <div className="wall-of-wins-card-foot">
            <SkeletonLine width="70%" height={13} />
            <SkeletonLine width="40%" height={11} />
          </div>
        </article>
      ))}
    </div>
  );
}

export function CourseWelcomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading course">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <SkeletonLine width={220} height={32} />
        <SkeletonShine className="lms-skeleton-btn-pill" />
      </div>
      <div className="mb-4">
        <SkeletonLine width={100} height={18} className="mb-3" />
        <div className="lms-card p-4 lms-skeleton-progress-card">
          <div className="d-flex justify-content-between mb-3">
            <SkeletonLine width="42%" height={18} />
            <SkeletonLine width={40} height={18} />
          </div>
          <SkeletonShine className="lms-skeleton-progress-bar" />
        </div>
      </div>
      <div className="row g-3 mb-4">
        {range(3).map((i) => (
          <div key={i} className="col-12 col-md-4">
            <div className="lms-card p-3">
              <SkeletonLine width="50%" height={10} />
              <SkeletonLine width={32} height={24} className="mt-2" />
            </div>
          </div>
        ))}
      </div>
      <SkeletonLine width={120} height={22} className="mb-3" />
      {range(3).map((i) => (
        <div key={i} className="lms-card p-3 mb-2 lms-skeleton-section-row">
          <SkeletonLine width={`${55 + i * 10}%`} height={16} />
        </div>
      ))}
    </div>
  );
}

export function CourseVideoPlayerSkeleton() {
  return (
    <div className="row g-3 align-items-start" aria-busy="true" aria-label="Loading player">
      <div className="col-xl-8">
        <div className="lms-card p-0 overflow-hidden border-0 lms-skeleton-player-card">
          <div className="p-3 border-bottom">
            <SkeletonLine width="55%" height={20} />
          </div>
          <SkeletonShine className="lms-skeleton-player-video" />
        </div>
      </div>
      <div className="col-xl-4">
        <div className="lms-card p-3">
          {range(5).map((i) => (
            <div key={i} className="d-flex gap-2 mb-3">
              <SkeletonShine className="lms-skeleton-lesson-thumb" />
              <div className="flex-grow-1">
                <SkeletonLine width="88%" height={12} />
                <SkeletonLine width="40%" height={10} className="mt-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DocCenterDetailSkeleton() {
  return (
    <article className="dc-feed-card dc-feed-skeleton-layout" aria-busy="true" aria-label="Loading document">
      <div className="dc-feed-header-row">
        <SkeletonLine className="lms-skeleton-line--title" width="52%" height={24} />
        <div className="d-flex gap-2">
          <SkeletonShine className="lms-skeleton-icon-btn" />
          <SkeletonShine className="lms-skeleton-icon-btn" />
        </div>
      </div>
      <SkeletonLine width="94%" height={14} />
      <SkeletonLine width="88%" height={14} />
      <SkeletonShine className="lms-skeleton-cta-btn" />
      <SkeletonLine width="46%" height={18} className="mt-4" />
      {range(4).map((i) => (
        <SkeletonLine key={i} width={`${78 - i * 6}%`} height={12} className="mt-2" />
      ))}
      <div className="lms-skeleton-social-bar mt-4">
        <SkeletonShine className="lms-skeleton-badge" />
        <SkeletonShine className="lms-skeleton-badge" />
      </div>
      <CommentListSkeleton count={2} />
    </article>
  );
}

export function FeedReportDetailSkeleton() {
  return (
    <div className="row g-3" aria-busy="true" aria-label="Loading report">
      <div className="col-lg-8">
        <div className="lms-card p-4">
          <SkeletonLine width="40%" height={22} className="mb-3" />
          <SkeletonLine width="100%" height={14} />
          <SkeletonLine width="92%" height={14} className="mt-2" />
          <SkeletonShine className="lms-skeleton-report-media mt-3" />
        </div>
      </div>
      <div className="col-lg-4">
        <div className="lms-card p-4">
          <SkeletonLine width="60%" height={16} className="mb-3" />
          {range(4).map((i) => (
            <SkeletonLine key={i} width="80%" height={12} className="mb-2" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function WallOfWinsDetailSkeleton() {
  return (
    <div className="row g-4" aria-busy="true" aria-label="Loading entry">
      <div className="col-lg-7">
        <SkeletonShine className="lms-skeleton-wow-detail-media" />
      </div>
      <div className="col-lg-5">
        <SkeletonLine width="70%" height={22} />
        <SkeletonLine width="40%" height={12} className="mt-2" />
        <SkeletonLine width="100%" height={14} className="mt-3" />
        <SkeletonLine width="88%" height={14} className="mt-2" />
      </div>
    </div>
  );
}

export function WelcomeVideoSkeleton() {
  return (
    <div className="ratio ratio-16x9 lms-skeleton-welcome-video" aria-busy="true" aria-label="Loading video">
      <SkeletonShine className="lms-skeleton-welcome-video-inner" />
    </div>
  );
}

export function UserListSkeleton({ count = 5 }) {
  return (
    <div className="lms-skeleton-user-list" aria-busy="true" aria-label="Loading users">
      {range(count).map((i) => (
        <div key={i} className="lms-skeleton-user-row" aria-hidden>
          <SkeletonLine width="38%" height={14} />
          <SkeletonLine width="52%" height={11} className="mt-1" />
        </div>
      ))}
    </div>
  );
}

export function AskRyanAdminListSkeleton({ count = 5 }) {
  return (
    <ul className="list-group list-group-flush" aria-busy="true" aria-label="Loading questions">
      {range(count).map((i) => (
        <li key={i} className="list-group-item px-0 py-3" aria-hidden>
          <SkeletonLine width={`${62 + (i % 3) * 10}%`} height={14} />
        </li>
      ))}
    </ul>
  );
}

export function AdminMonthlyDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading month detail">
      {range(4).map((w) => (
        <section key={w} className="admin-mcm-panel lms-card admin-mcm-detail-week mb-3 lms-skeleton-mcm-week">
          <div className="admin-mcm-panel-head admin-mcm-panel-head--flush admin-mcm-detail-week-head px-3 py-3">
            <SkeletonLine width={88} height={18} />
            <SkeletonShine className="lms-skeleton-badge lms-skeleton-badge--sm" />
          </div>
          <div className="px-3 py-3 px-md-4">
            {range(2).map((i) => (
              <SkeletonLine key={i} width={`${70 - i * 8}%`} height={13} className="mb-2" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function OmCatalogHeroSkeleton() {
  return (
    <div className="lms-om-admin-hero lms-card p-4 p-md-5 mb-3" aria-busy="true" aria-label="Loading catalog entry">
      <div className="row g-4 align-items-center">
        <div className="col-lg-8">
          <SkeletonLine width={100} height={10} />
          <SkeletonLine width="44%" height={26} className="mt-2" />
          <SkeletonLine width="68%" height={14} className="mt-2" />
          <div className="lms-skeleton-badge-row mt-3">
            <SkeletonShine className="lms-skeleton-badge" />
            <SkeletonShine className="lms-skeleton-badge" />
            <SkeletonShine className="lms-skeleton-badge" />
          </div>
        </div>
        <div className="col-lg-4">
          <SkeletonShine className="lms-skeleton-om-preview" />
        </div>
      </div>
    </div>
  );
}

export function MemberProfileSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading profile">
      <div className="member-profile-modal-status-row mb-3">
        <SkeletonShine className="lms-skeleton-profile-pill" />
      </div>
      <SkeletonLine width="55%" height={12} className="mb-3" />
      <SkeletonLine width="70%" height={12} className="mb-2" />
      <SkeletonLine width="62%" height={12} className="mb-2" />
      <SkeletonLine width="48%" height={12} />
    </div>
  );
}

export function AdminTablePanelSkeleton({ rows = 4 }) {
  return (
    <div className="admin-mcm-table-wrap px-3 py-3" aria-busy="true" aria-label="Loading table">
      {range(rows).map((i) => (
        <div key={i} className="d-flex align-items-center gap-3 py-3 border-bottom" aria-hidden>
          <SkeletonLine width="22%" height={14} />
          <SkeletonLine width="34%" height={14} />
          <SkeletonLine width={64} height={28} className="ms-auto" />
        </div>
      ))}
    </div>
  );
}

export function MemberDirectoryGridSkeleton({ count = 8 }) {
  return (
    <div className="member-directory-grid" aria-busy="true" aria-label="Loading members">
      {range(count).map((i) => (
        <article key={i} className="member-directory-card member-directory-card--skeleton" aria-hidden>
          <SkeletonShine className="member-directory-card-avatar lms-skeleton-member-avatar" />
          <SkeletonLine width="68%" height={16} className="mt-2" />
          <SkeletonLine width="88%" height={11} className="mt-2" />
          <SkeletonLine width="54%" height={11} className="mt-2" />
          <SkeletonShine className="lms-skeleton-member-msg-btn mt-3" />
        </article>
      ))}
    </div>
  );
}

export function FeedReportsTableSkeleton({ rows = 5, cols = 6 }) {
  return (
    <div className="table-responsive" aria-busy="true" aria-label="Loading reports">
      <table className="table align-middle mb-0">
        <tbody>
          <TableSkeleton rows={rows} cols={cols} />
        </tbody>
      </table>
    </div>
  );
}

export function GenericListSkeleton({ count = 4, className = "" }) {
  return (
    <div className={`lms-skeleton-generic-list ${className}`.trim()} aria-busy="true">
      {range(count).map((i) => (
        <SkeletonLine key={i} width={`${70 + (i % 3) * 8}%`} height={13} className="mb-3" />
      ))}
    </div>
  );
}

export function SuggestedVideoListSkeleton({ count = 3 }) {
  return (
    <ul className="list-unstyled mb-0 sell-snack-suggested-list" aria-busy="true" aria-label="Loading suggestions">
      {range(count).map((i) => (
        <li key={i} className="mb-3 d-flex gap-3" aria-hidden>
          <SkeletonShine className="lms-skeleton-suggested-thumb flex-shrink-0" />
          <div className="flex-grow-1 min-w-0">
            <SkeletonLine width="42%" height={10} />
            <SkeletonLine width="78%" height={14} className="mt-2" />
            <SkeletonLine width="50%" height={11} className="mt-2" />
          </div>
        </li>
      ))}
    </ul>
  );
}
