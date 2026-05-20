import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

import { createPortal } from "react-dom";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  FiAlignLeft,
  FiAtSign,
  FiAward,
  FiBarChart2,
  FiBookmark,
  FiChevronDown,
  FiCode,
  FiEdit2,
  FiFileText,
  FiFilm,
  FiFlag,
  FiHash,
  FiHeart,
  FiImage,
  FiLink,
  FiList,
  FiMaximize2,
  FiMessageCircle,
  FiMinimize2,
  FiMic,
  FiMinus,
  FiMoreHorizontal,
  FiMoreVertical,
  FiMusic,
  FiPaperclip,
  FiPlus,
  FiSend,
  FiSlash,
  FiSmile,
  FiThumbsDown,
  FiThumbsUp,
  FiTrash2,
  FiUpload,
  FiUser,
  FiVideo,
} from "react-icons/fi";
import StudentDashboardSectionPage from "./StudentDashboardSectionPage";
import CommunityVideoPlayer from "../../components/CommunityVideoPlayer";
import CommentReportReasonModal from "../../components/CommentReportReasonModal";
import MemberProfileModal from "../../components/MemberProfileModal";
import { REPORT_REASONS } from "../../constants/reportReasons";
import sellitStarterImage from "../../assets/feed.png";

const sortOptions = [
  "For you",
  "Alphabetical",
  "Latest",
  "Likes",
  "New activity",
  "Oldest",
  "Popular",
];
const COMMENTS_PAGE_SIZE = 7;
const FEED_PAGE_SIZE = 7;
const FEED_BOOKMARKS_STORAGE_KEY = "student_community_feed_bookmarks";
const UPCOMING_EVENTS = [
  { month: "MAY", day: "20", title: "LIVE with Ryan Serhant", time: "12:30 - 1:00 AM IST" },
  { month: "MAY", day: "22", title: "AI Academy: Build Your 'Balls Up' System", time: "12:30 - 1:00 AM IST" },
  { month: "MAY", day: "22", title: "AI Academy: Build Your 'Balls Up' System", time: "12:30 - 1:00 AM IST" },
  { month: "MAY", day: "26", title: "Build the Pipeline Part 3: Negotiation + Closer", time: "10:30 - 11:00 PM IST" },
  { month: "JUN", day: "17", title: "LIVE with Ryan Serhant", time: "12:30 - 1:00 AM IST" },
];
const TRENDING_POSTS = [
  { initials: "EP", title: "G' Day from Coastal San Diego", author: "Etienne Pieterse", tone: "berry" },
  { initials: "GP", title: "Anyone interested in a weekly 30-min AI meetup?", author: "Glen Primak", tone: "sand" },
  { initials: "SO", title: "Your Los Angeles Architectural Agent", author: "Stefany Gonzalez", tone: "amber" },
  { initials: "JF", title: "Your Sell It profile is about to get more work for you.", author: "Julie Fantechi", tone: "rose" },
  { initials: "KA", title: "Let's connect on instagram", author: "Kat Azimi", tone: "slate" },
];

/** Spaces shown in Create post → "Posting in" (UI; server post body unchanged). */
const POSTING_SPACES = [
  {
    id: "meet-greet",
    top: "welcome",
    emoji: "👋",
    title: "Meet + Greet",
    search: "welcome meet greet",
  },
  {
    id: "sell-it-community",
    top: "Community",
    emoji: "",
    title: "Feed",
    search: "community sell it",
  },
  {
    id: "referral-partners",
    top: "",
    emoji: "🤝",
    title: "Referral Partners",
    search: "referral partners",
  },
  {
    id: "community-listings",
    top: "",
    emoji: "🏠",
    title: "Community Listings",
    search: "listings home community",
  },
  {
    id: "workshop-replays",
    top: "",
    emoji: "📽️",
    title: "Workshop Replays",
    search: "workshop replays",
  },
  {
    id: "sell-it-short-courses",
    top: "",
    emoji: "",
    title: "Sell It Short Courses",
    search: "short courses sell it",
  },
];

const resolveDefaultPostingSpaceId = (contextLabel) => {
  const t = String(contextLabel || "")
    .trim()
    .toLowerCase();
  if (t.includes("meet") && t.includes("greet")) return "meet-greet";
  if (t.includes("referral")) return "referral-partners";
  if (t.includes("listing")) return "community-listings";
  if (t.includes("workshop") && t.includes("replay")) return "workshop-replays";
  if (t.includes("short") && t.includes("course"))
    return "sell-it-short-courses";
  if (t.includes("sell it") && t.includes("community"))
    return "sell-it-community";
  return "sell-it-community";
};

const editorCommandGroups = [
  {
    label: "Basic",
    items: [
      { label: "Paragraph", Icon: FiAlignLeft, insert: "", format: null },
      {
        label: "Heading 2",
        Icon: FiHash,
        insert: "## ",
        format: { type: "heading2", prefix: "## " },
      },
      {
        label: "Heading 3",
        Icon: FiHash,
        insert: "### ",
        format: { type: "heading3", prefix: "### " },
      },
      {
        label: "Numbered list",
        Icon: FiList,
        insert: "1. ",
        format: { type: "numbered", prefix: "1. " },
      },
      {
        label: "Bulleted list",
        Icon: FiList,
        insert: "- ",
        format: { type: "bulleted", prefix: "- " },
      },
      {
        label: "Blockquote",
        Icon: FiMinus,
        insert: "> ",
        format: { type: "blockquote", prefix: "> " },
      },
      { label: "Divider", Icon: FiMinus, insert: "\n---\n" },
      { label: "Mention", Icon: FiAtSign, insert: "@" },
    ],
  },
  {
    label: "Upload",
    items: [
      { label: "Image", Icon: FiImage, upload: true },
      { label: "File", Icon: FiPaperclip, upload: true },
      { label: "Audio", Icon: FiMusic, upload: true },
      { label: "Voice message", Icon: FiMic, upload: true },
      { label: "Video clip", Icon: FiVideo, upload: true },
      { label: "Video", Icon: FiFilm, upload: true },
      { label: "PDF", Icon: FiFileText, upload: true },
      { label: "Giphy", Icon: FiImage, insert: "\nGiphy: " },
    ],
  },
];

const formatCountLabel = (count) => {
  const value = Number(count || 0);
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return `${value}`;
};

const formatPostDate = (value) => {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getInitial = (name) =>
  String(name || "M")
    .trim()
    .charAt(0)
    .toUpperCase() || "M";

const MEMBER_HOVER_CARD_WIDTH = 288;

const resolveMemberStatusTier = (member, listIndex = 0) => {
  const n = Number(member?.id);
  if (Number.isFinite(n) && n > 0) return (n % 9) + 1;
  return ((Number(listIndex) || 0) % 9) + 1;
};

const buildMemberHoverTagline = (member) => {
  const role = String(member?.role || "Student").trim().toLowerCase();
  if (role === "student") return "Learning fast. Selling smart.";
  return `${String(member?.role || "Member").trim()} · Sell It member`;
};

const isInteractiveEventTarget = (target) =>
  Boolean(
    target?.closest?.(
      "button, input, textarea, select, a, form, [role='button']",
    ),
  );

const resolveMediaType = (post) => {
  const type = String(post?.media_type || "").toLowerCase();
  if (type) return type;
  const mime = String(post?.media_mime || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return post?.media_url ? "document" : "";
};

const getContentPreview = (value, expanded) => {
  const text = String(value || "").trim();
  if (expanded || text.length <= 180) return text;
  return `${text.slice(0, 180).trim()}...`;
};

const buildCommentTree = (comments = []) => {
  const nodeMap = {};
  const roots = [];
  comments.forEach((comment) => {
    nodeMap[String(comment.id)] = { ...comment, replies: [] };
  });
  comments.forEach((comment) => {
    const node = nodeMap[String(comment.id)];
    const parentId = comment.parent_comment_id;
    if (parentId && nodeMap[String(parentId)]) {
      nodeMap[String(parentId)].replies.push(node);
      return;
    }
    roots.push(node);
  });
  return roots;
};

const updateCommentInList = (comments = [], commentId, updater) =>
  comments.map((comment) =>
    String(comment.id) === String(commentId) ? updater(comment) : comment,
  );

const collectDescendantCommentIdsFromFlat = (comments = [], rootId) => {
  const byParent = new Map();
  comments.forEach((c) => {
    if (c.parent_comment_id == null) return;
    const pid = String(c.parent_comment_id);
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(c.id);
  });
  const remove = new Set([String(rootId)]);
  const frontier = [String(rootId)];
  while (frontier.length) {
    const id = frontier.pop();
    const kids = byParent.get(id) || [];
    kids.forEach((kid) => {
      const ks = String(kid);
      if (!remove.has(ks)) {
        remove.add(ks);
        frontier.push(ks);
      }
    });
  }
  return remove;
};

const resolveFilePreviewType = (file) => {
  const mime = String(file?.type || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  return file ? "document" : "";
};

const resolveVideoPlaybackUrl = (attachment) => {
  const variants = Array.isArray(attachment?.video_variants)
    ? attachment.video_variants
    : [];
  const readyVariants = variants.filter(
    (variant) => variant.status === "ready" && variant.media_url,
  );
  const preferredVariant =
    readyVariants.find((variant) => variant.resolution === "720p") ||
    readyVariants.find((variant) => variant.resolution === "1080p") ||
    readyVariants.find((variant) => variant.resolution === "360p");
  return preferredVariant?.media_url || attachment?.media_url || "";
};

const preventProtectedMediaAction = (event) => {
  event.preventDefault();
  event.stopPropagation();
};

const protectedMediaHandlers = {
  onContextMenu: preventProtectedMediaAction,
  onDragStart: preventProtectedMediaAction,
};

const resolveAuthenticatedMediaUrl = (src) => {
  if (!src) return "";
  try {
    const url = new URL(src, window.location.origin);
    if (url.pathname.startsWith("/api/feed/media/")) {
      url.search = "";
    }
    return url.toString();
  } catch {
    return String(src).split("?")[0];
  }
};

const hasProcessingVideoVariants = (attachment) =>
  Array.isArray(attachment?.video_variants) &&
  attachment.video_variants.some(
    (variant) =>
      variant.status === "pending" || variant.status === "processing",
  );

const getProcessingPostProgress = (post) => {
  if (post?.processing_status === "failed") return "Processing failed";
  const variants = (post?.attachments || []).flatMap(
    (attachment) => attachment.video_variants || [],
  );
  if (!variants.length) return "Preparing video";
  const readyCount = variants.filter(
    (variant) => variant.status === "ready",
  ).length;
  return `${readyCount}/${variants.length} resolutions ready`;
};

function ProtectedFeedImage({ src, alt, className = "" }) {
  const [loadedImage, setLoadedImage] = useState({ src: "", objectUrl: "" });

  useEffect(() => {
    if (!src) return undefined;

    let isActive = true;
    let nextObjectUrl = "";
    const controller = new AbortController();

    const loadImage = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(resolveAuthenticatedMediaUrl(src), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Unable to load protected image.");
        const blob = await response.blob();
        nextObjectUrl = URL.createObjectURL(blob);
        if (isActive) setLoadedImage({ src, objectUrl: nextObjectUrl });
      } catch {
        if (isActive) setLoadedImage({ src, objectUrl: "" });
      }
    };

    loadImage();

    return () => {
      isActive = false;
      controller.abort();
      if (nextObjectUrl) URL.revokeObjectURL(nextObjectUrl);
    };
  }, [src]);

  const objectUrl = loadedImage.src === src ? loadedImage.objectUrl : "";

  if (!objectUrl) {
    return (
      <span
        className={`student-community-protected-image-placeholder ${className}`}
        aria-label={alt}
      />
    );
  }

  return (
    <img
      src={objectUrl}
      alt={alt}
      className={className}
      draggable={false}
      {...protectedMediaHandlers}
    />
  );
}

const renderMedia = (post, onImageClick) => {
  const attachments =
    Array.isArray(post.attachments) && post.attachments.length > 0
      ? post.attachments
      : post.media_url
        ? [
          {
            media_url: post.media_url,
            media_type: post.media_type,
            media_name: post.media_name,
            media_mime: post.media_mime,
          },
        ]
        : [];
  if (!attachments.length) return null;
  if (attachments.length > 1) {
    return (
      <div
        className={`student-community-gallery count-${Math.min(attachments.length, 4)}`}
      >
        {attachments.slice(0, 4).map((attachment, index) => {
          const mediaType = String(attachment.media_type || "").toLowerCase();
          const extraCount = attachments.length - 4;
          return (
            <div
              key={attachment.id || attachment.media_url}
              className="student-community-gallery-item"
            >
              {mediaType === "image" ? (
                <button
                  type="button"
                  className="student-community-image-open"
                  onClick={(event) => {
                    event.stopPropagation();
                    onImageClick?.(
                      attachment.media_url,
                      attachment.media_name || post.heading || "Feed media",
                    );
                  }}
                  onContextMenu={preventProtectedMediaAction}
                >
                  <ProtectedFeedImage
                    src={attachment.media_url}
                    alt={attachment.media_name || post.heading || "Feed media"}
                  />
                </button>
              ) : mediaType === "video" ? (
                <>
                  <CommunityVideoPlayer
                    src={resolveVideoPlaybackUrl(attachment)}
                    title={
                      attachment.media_name || post.heading || "Feed video"
                    }
                    variants={attachment.video_variants || []}
                    compact
                  />
                  {hasProcessingVideoVariants(attachment) && (
                    <span className="student-community-video-processing">
                      Processing HD
                    </span>
                  )}
                </>
              ) : (
                <a href={attachment.media_url} target="_blank" rel="noreferrer">
                  <FiFileText />
                  <span>{attachment.media_name || "Open file"}</span>
                </a>
              )}
              {index === 3 && extraCount > 0 && (
                <span className="student-community-gallery-more">
                  +{extraCount}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }
  const singleAttachment = attachments[0];
  const singlePost = {
    ...post,
    media_url: singleAttachment.media_url,
    media_type: singleAttachment.media_type,
    media_name: singleAttachment.media_name,
    media_mime: singleAttachment.media_mime,
    video_variants: singleAttachment.video_variants,
  };
  if (!singlePost.media_url) return null;
  const mediaType = resolveMediaType(singlePost);
  if (mediaType === "image") {
    return (
      <div className="student-community-media-wrap">
        <button
          type="button"
          className="student-community-image-open"
          onClick={(event) => {
            event.stopPropagation();
            onImageClick?.(
              singlePost.media_url,
              singlePost.heading || "Feed media",
            );
          }}
          onContextMenu={preventProtectedMediaAction}
        >
          <ProtectedFeedImage
            src={singlePost.media_url}
            alt={singlePost.heading || "Feed media"}
            className="student-community-media"
          />
        </button>
      </div>
    );
  }
  if (mediaType === "video") {
    return (
      <div className="student-community-media-wrap bg-dark">
        <CommunityVideoPlayer
          src={resolveVideoPlaybackUrl(singlePost)}
          title={singlePost.heading || "Feed video"}
          variants={singlePost.video_variants || []}
        />
        {hasProcessingVideoVariants(singlePost) && (
          <span className="student-community-video-processing">
            Processing 360p / 720p / 1080p
          </span>
        )}
      </div>
    );
  }
  return (
    <a
      href={singlePost.media_url}
      target="_blank"
      rel="noreferrer"
      className="student-community-document text-decoration-none"
    >
      <span className="student-community-document-icon">
        <FiFileText />
      </span>
      <span>
        <strong>{singlePost.media_name || "Open attached document"}</strong>
        <small>Document attachment</small>
      </span>
    </a>
  );
};

export default function StudentCommunityFeedPage({
  SectionComponent = StudentDashboardSectionPage,
  title = "Feed",
  storageKey = FEED_BOOKMARKS_STORAGE_KEY,
  roleBadge = "Member",
  postingContext = "Feed",
  showMyFeedFilter = true,
  feedVariant = "default",
  feedSpaceFilter = "",
  showMembersRail = false,
  membersRailCtaPath = "/dashboard/student-members",
  membersRailCtaLabel = "See members",
  memberProfileLinkTo = "/dashboard/student-members",
  showMemberProfileMessageButton = true,
  memberProfileMessagesPath = "/dashboard/student-messages",
}) {
  const location = useLocation();
  const showFeedInsightsRail = location.pathname === "/dashboard/feed";
  const effectiveShowMembersRail = showMembersRail && !showFeedInsightsRail;
  const [searchParams, setSearchParams] = useSearchParams();
  const DashboardSection = SectionComponent;
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const [railMembers, setRailMembers] = useState([]);
  const [memberHoverPopover, setMemberHoverPopover] = useState(null);
  const [memberProfileModalUser, setMemberProfileModalUser] = useState(null);
  const memberPopoverCloseTimer = useRef(null);

  useEffect(() => {
    const raw = searchParams.get("memberProfile");
    const id = Number(raw);
    if (!Number.isFinite(id) || id <= 0) return;
    setMemberProfileModalUser((prev) => {
      if (prev && Number(prev.id) === id) return prev;
      return { id };
    });
  }, [searchParams]);

  const closeMemberProfileModal = useCallback(() => {
    setMemberProfileModalUser(null);
    if (searchParams.has("memberProfile")) {
      const next = new URLSearchParams(searchParams);
      next.delete("memberProfile");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [posts, setPosts] = useState([]);
  const [processingPosts, setProcessingPosts] = useState([]);
  const [formValues, setFormValues] = useState({
    heading: "",
    subHeading: "",
    content: "",
  });
  const [mediaFiles, setMediaFiles] = useState([]);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [replyDrafts, setReplyDrafts] = useState({});
  const [activeReplyMap, setActiveReplyMap] = useState({});
  const [feedCommentEditingKey, setFeedCommentEditingKey] = useState(null);
  const [feedCommentEditDraft, setFeedCommentEditDraft] = useState("");
  const [feedCommentBusyId, setFeedCommentBusyId] = useState(null);
  const [feedCommentMenuOpenKey, setFeedCommentMenuOpenKey] = useState(null);
  const [openCommentsMap, setOpenCommentsMap] = useState({});
  const [visibleCommentCounts, setVisibleCommentCounts] = useState({});
  const [expandedPosts, setExpandedPosts] = useState({});
  const [animatedLikeMap, setAnimatedLikeMap] = useState({});
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState(null);
  const [isPostDetailFullscreen, setIsPostDetailFullscreen] = useState(false);
  const [activePostMenuId, setActivePostMenuId] = useState(null);
  const [feedReportModal, setFeedReportModal] = useState(null);
  const [selectedReportReason, setSelectedReportReason] = useState("");
  const [bookmarkedPostMap, setBookmarkedPostMap] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch {
      return {};
    }
  });
  const [showComposer, setShowComposer] = useState(false);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [selectedPostingSpaceId, setSelectedPostingSpaceId] = useState(() => {
    if (feedVariant === "communityHub") return "sell-it-community";
    const trimmed =
      typeof feedSpaceFilter === "string" ? feedSpaceFilter.trim() : "";
    return trimmed || resolveDefaultPostingSpaceId(postingContext);
  });
  const [postingSpaceMenuOpen, setPostingSpaceMenuOpen] = useState(false);
  const [postingSpaceSearch, setPostingSpaceSearch] = useState("");
  const postingSpaceSearchRef = useRef(null);
  const [activeBlockFormat, setActiveBlockFormat] = useState(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [activeSort, setActiveSort] = useState("Latest");
  const [feedScope, setFeedScope] = useState("all");
  const [feedOffset, setFeedOffset] = useState(0);
  const [hasMoreFeed, setHasMoreFeed] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const currentUser = useMemo(
    () => JSON.parse(localStorage.getItem("user") || "{}"),
    [],
  );

  /** Space sent to GET /api/feed — hub always pins sell-it-community. */
  const effectiveFeedSpaceFilter = useMemo(() => {
    if (feedVariant === "communityHub") return "sell-it-community";
    return typeof feedSpaceFilter === "string" ? feedSpaceFilter.trim() : "";
  }, [feedSpaceFilter, feedVariant]);

  useEffect(() => {
    if (!effectiveShowMembersRail) {
      setRailMembers([]);
      return undefined;
    }
    const token = localStorage.getItem("token");
    if (!token) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/users/members`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await res.json();
        if (!res.ok || payload.status !== "success") return;
        const list = Array.isArray(payload.data) ? payload.data : [];
        if (!cancelled) setRailMembers(list.slice(0, 6));
      } catch {
        if (!cancelled) setRailMembers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveShowMembersRail, apiBaseUrl]);

  const clearMemberPopoverTimer = useCallback(() => {
    if (memberPopoverCloseTimer.current) {
      window.clearTimeout(memberPopoverCloseTimer.current);
      memberPopoverCloseTimer.current = null;
    }
  }, []);

  const openMemberPopover = useCallback(
    (member, anchorEl, listIndex) => {
      clearMemberPopoverTimer();
      if (!anchorEl) return;
      const rect = anchorEl.getBoundingClientRect();
      setMemberHoverPopover({ member, rect, listIndex });
    },
    [clearMemberPopoverTimer],
  );

  const scheduleCloseMemberPopover = useCallback(() => {
    clearMemberPopoverTimer();
    memberPopoverCloseTimer.current = window.setTimeout(() => {
      setMemberHoverPopover(null);
    }, 220);
  }, [clearMemberPopoverTimer]);

  const keepMemberPopoverOpen = useCallback(() => {
    clearMemberPopoverTimer();
  }, [clearMemberPopoverTimer]);

  useEffect(() => {
    if (!memberHoverPopover) return undefined;
    const onScroll = () => setMemberHoverPopover(null);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [memberHoverPopover]);

  useEffect(
    () => () => {
      clearMemberPopoverTimer();
    },
    [clearMemberPopoverTimer],
  );

  const mediaPreviewItems = useMemo(
    () =>
      mediaFiles.map((file) => ({
        file,
        url: URL.createObjectURL(file),
        type: resolveFilePreviewType(file),
      })),
    [mediaFiles],
  );

  useEffect(() => {
    if (!mediaPreviewItems.length) return undefined;
    return () =>
      mediaPreviewItems.forEach((item) => URL.revokeObjectURL(item.url));
  }, [mediaPreviewItems]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(bookmarkedPostMap));
  }, [bookmarkedPostMap, storageKey]);

  useEffect(() => {
    if (effectiveFeedSpaceFilter) {
      setSelectedPostingSpaceId(effectiveFeedSpaceFilter);
      return;
    }
    setSelectedPostingSpaceId(resolveDefaultPostingSpaceId(postingContext));
  }, [postingContext, effectiveFeedSpaceFilter]);

  const selectedPostingSpace = useMemo(
    () =>
      POSTING_SPACES.find((s) => s.id === selectedPostingSpaceId) ||
      POSTING_SPACES[0],
    [selectedPostingSpaceId],
  );

  const filteredPostingSpaces = useMemo(() => {
    const q = postingSpaceSearch.trim().toLowerCase();
    if (!q) return POSTING_SPACES;
    return POSTING_SPACES.filter((s) => {
      const hay = `${s.search} ${s.title} ${s.top} ${s.emoji}`.toLowerCase();
      return hay.includes(q);
    });
  }, [postingSpaceSearch]);

  useEffect(() => {
    if (!showComposer) {
      setPostingSpaceMenuOpen(false);
      setPostingSpaceSearch("");
    }
  }, [showComposer]);

  useEffect(() => {
    if (!postingSpaceMenuOpen) return undefined;
    const onDocMouseDown = (event) => {
      if (!event.target.closest(".student-community-posting-space-wrap")) {
        setPostingSpaceMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [postingSpaceMenuOpen]);

  useEffect(() => {
    if (postingSpaceMenuOpen) {
      queueMicrotask(() => postingSpaceSearchRef.current?.focus());
    }
  }, [postingSpaceMenuOpen]);

  const sortedPosts = useMemo(() => {
    const nextPosts = [...posts];
    if (activeSort === "Alphabetical") {
      return nextPosts.sort((a, b) =>
        String(a.heading || "").localeCompare(String(b.heading || "")),
      );
    }
    if (activeSort === "Likes" || activeSort === "Popular") {
      return nextPosts.sort(
        (a, b) => Number(b.likes_count || 0) - Number(a.likes_count || 0),
      );
    }
    if (activeSort === "Oldest") {
      return nextPosts.sort(
        (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0),
      );
    }
    if (activeSort === "New activity") {
      return nextPosts.sort((a, b) => {
        const bActivity =
          Number(b.comments_count || 0) + Number(b.likes_count || 0);
        const aActivity =
          Number(a.comments_count || 0) + Number(a.likes_count || 0);
        return bActivity - aActivity;
      });
    }
    return nextPosts.sort(
      (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
    );
  }, [activeSort, posts]);

  const selectedPost = useMemo(
    () =>
      posts.find((post) => String(post.id) === String(selectedPostId)) || null,
    [posts, selectedPostId],
  );
  const selectedPostCommentTree = useMemo(
    () => buildCommentTree(selectedPost?.comments || []),
    [selectedPost],
  );
  const selectedPostIndex = useMemo(
    () =>
      sortedPosts.findIndex(
        (post) => String(post.id) === String(selectedPostId),
      ),
    [selectedPostId, sortedPosts],
  );
  const previousPost =
    selectedPostIndex > 0 ? sortedPosts[selectedPostIndex - 1] : null;
  const nextPost =
    selectedPostIndex >= 0 && selectedPostIndex < sortedPosts.length - 1
      ? sortedPosts[selectedPostIndex + 1]
      : null;

  const fetchFeedPage = useCallback(
    async ({ offset = 0, append = false, silent = false } = {}) => {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Session missing. Please login first.");
        return;
      }
      try {
        if (!silent) {
          if (append) setIsLoadingMore(true);
          else setIsLoading(true);
          setError("");
        }
        const params = new URLSearchParams();
        params.set("limit", String(FEED_PAGE_SIZE));
        params.set("offset", String(offset));
        if (showMyFeedFilter && feedScope === "mine") params.set("mine", "1");
        if (effectiveFeedSpaceFilter)
          params.set("space", effectiveFeedSpaceFilter);
        const response = await fetch(
          `${apiBaseUrl}/api/feed?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const payload = await response.json();
        if (!response.ok || payload.status !== "success") {
          throw new Error(payload.message || "Unable to fetch feed posts.");
        }
        const rows = Array.isArray(payload.data) ? payload.data : [];
        const processingRows = Array.isArray(payload.processing_posts)
          ? payload.processing_posts
          : [];
        setPosts((prev) => {
          if (!append) return rows;
          const existingIds = new Set(prev.map((post) => String(post.id)));
          return [
            ...prev,
            ...rows.filter((post) => !existingIds.has(String(post.id))),
          ];
        });
        setProcessingPosts(processingRows);
        setFeedOffset(payload.pagination?.next_offset ?? offset + rows.length);
        setHasMoreFeed(Boolean(payload.pagination?.has_more));
      } catch (fetchError) {
        if (!silent)
          setError(fetchError.message || "Unable to fetch feed posts.");
      } finally {
        if (!silent) {
          if (append) setIsLoadingMore(false);
          else setIsLoading(false);
        }
      }
    },
    [apiBaseUrl, feedScope, showMyFeedFilter, effectiveFeedSpaceFilter],
  );

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      fetchFeedPage({ offset: 0, append: false });
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [fetchFeedPage]);

  useEffect(() => {
    if (!processingPosts.length) return undefined;
    const refreshTimer = window.setInterval(() => {
      fetchFeedPage({ offset: 0, append: false, silent: true });
    }, 10000);
    return () => window.clearInterval(refreshTimer);
  }, [fetchFeedPage, processingPosts.length]);

  useEffect(() => {
    const handleFeedScroll = () => {
      if (!hasMoreFeed || isLoading || isLoadingMore) return;
      const scrollPosition = window.innerHeight + window.scrollY;
      const triggerPosition = document.documentElement.scrollHeight - 600;
      if (scrollPosition >= triggerPosition) {
        fetchFeedPage({ offset: feedOffset, append: true });
      }
    };

    window.addEventListener("scroll", handleFeedScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleFeedScroll);
  }, [feedOffset, fetchFeedPage, hasMoreFeed, isLoading, isLoadingMore]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleContentChange = (event) => {
    const value = event.target.value;
    setFormValues((prev) => ({ ...prev, content: value }));
    setShowCommandMenu(value.endsWith("/"));
  };

  const moveTextareaCursor = (position) => {
    requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(position, position);
      textareaRef.current?.focus();
    });
  };

  const getNextBlockPrefix = (format, currentLine) => {
    if (!format) return "";
    if (format.type !== "numbered") return format.prefix || "";
    const match = currentLine.match(/^(\d+)\.\s/);
    const nextNumber = match ? Number(match[1]) + 1 : 1;
    return `${nextNumber}. `;
  };

  const getCurrentLinePrefix = (format, currentLine) => {
    if (!format) return "";
    if (format.type !== "numbered")
      return currentLine.match(/^\d+\.\s/)?.[0] || format.prefix || "";
    return format.prefix || "";
  };

  const handleContentKeyDown = (event) => {
    if (event.key !== "Enter" || event.shiftKey || !activeBlockFormat) return;
    event.preventDefault();

    const content = formValues.content;
    const cursor = event.currentTarget.selectionStart;
    const selectionEnd = event.currentTarget.selectionEnd;
    const lineStart = content.lastIndexOf("\n", cursor - 1) + 1;
    const currentLine = content.slice(lineStart, cursor);
    const currentPrefix = getCurrentLinePrefix(activeBlockFormat, currentLine);
    const lineWithoutPrefix = currentLine.startsWith(currentPrefix)
      ? currentLine.slice(currentPrefix.length)
      : currentLine;

    if (!lineWithoutPrefix.trim()) {
      const nextContent = `${content.slice(0, lineStart)}\n${content.slice(selectionEnd)}`;
      setFormValues((prev) => ({ ...prev, content: nextContent }));
      setActiveBlockFormat(null);
      moveTextareaCursor(lineStart + 1);
      return;
    }

    const nextPrefix = getNextBlockPrefix(activeBlockFormat, currentLine);
    const insertion = `\n${nextPrefix}`;
    const nextContent = `${content.slice(0, cursor)}${insertion}${content.slice(selectionEnd)}`;
    setFormValues((prev) => ({ ...prev, content: nextContent }));
    moveTextareaCursor(cursor + insertion.length);
  };

  const handleMediaFileChange = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    setMediaFiles((prev) => [...prev, ...selectedFiles]);
  };

  const removeMediaFile = (indexToRemove) => {
    setMediaFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const clearMediaFiles = () => {
    setMediaFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const renderMediaPreview = () => {
    if (!mediaPreviewItems.length) return null;
    return (
      <div className="student-community-upload-preview">
        <div className="student-community-upload-preview-head">
          <div>
            <strong>
              {mediaPreviewItems.length} file
              {mediaPreviewItems.length > 1 ? "s" : ""} selected
            </strong>
            <span>Multiple photos will publish as a gallery.</span>
          </div>
          <button type="button" onClick={clearMediaFiles}>
            Remove all
          </button>
        </div>

        <div className="student-community-upload-preview-grid">
          {mediaPreviewItems.map((item, index) => (
            <div
              key={`${item.file.name}-${index}`}
              className="student-community-upload-preview-tile"
            >
              {item.type === "image" && (
                <img
                  src={item.url}
                  alt={item.file.name}
                  draggable={false}
                  {...protectedMediaHandlers}
                />
              )}
              {item.type === "video" && (
                <CommunityVideoPlayer
                  src={item.url}
                  title={item.file.name}
                  compact
                />
              )}
              {item.type === "audio" && <audio src={item.url} controls />}
              {(item.type === "pdf" || item.type === "document") && (
                <div className="student-community-upload-preview-file compact">
                  <FiFileText />
                </div>
              )}
              <button
                type="button"
                onClick={() => removeMediaFile(index)}
                aria-label="Remove file"
              >
                ×
              </button>
              <span>{item.file.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const handleCommandSelect = (item) => {
    setShowCommandMenu(false);
    if (item.upload) {
      fileInputRef.current?.click();
      return;
    }
    setActiveBlockFormat(item.format || null);
    setFormValues((prev) => {
      const content = prev.content.endsWith("/")
        ? prev.content.slice(0, -1)
        : prev.content;
      return { ...prev, content: `${content}${item.insert || ""}` };
    });
    moveTextareaCursor(
      formValues.content.replace(/\/$/, "").length + (item.insert || "").length,
    );
  };

  const handleCreatePost = async (event) => {
    event.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Session missing. Please login first.");
      return;
    }
    if (!formValues.heading.trim()) {
      setError("Heading is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      setNotice("");
      const formData = new FormData();
      formData.append("heading", formValues.heading.trim());
      formData.append("sub_heading", formValues.subHeading.trim());
      formData.append("content", formValues.content.trim());
      formData.append(
        "posting_space",
        effectiveFeedSpaceFilter || selectedPostingSpaceId,
      );
      mediaFiles.forEach((file) => formData.append("media", file));

      const response = await fetch(`${apiBaseUrl}/api/feed`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to create feed post.");
      }

      if (payload.data?.processing_status === "ready") {
        setPosts((prev) => [payload.data, ...prev]);
      } else {
        setProcessingPosts((prev) => [
          payload.data,
          ...prev.filter((post) => String(post.id) !== String(payload.data.id)),
        ]);
        setNotice(
          "Video post processing me hai. Processing complete hone ke baad feed me dikhegi.",
        );
      }
      setFormValues({ heading: "", subHeading: "", content: "" });
      setMediaFiles([]);
      setShowComposer(false);
      setShowCommandMenu(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (submitError) {
      setError(submitError.message || "Unable to create feed post.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLike = async (postId) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/feed/${postId}/likes/toggle`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to update like.");
      }
      if (payload.data.is_liked) {
        setAnimatedLikeMap((prev) => ({ ...prev, [String(postId)]: true }));
        window.setTimeout(() => {
          setAnimatedLikeMap((prev) => ({ ...prev, [String(postId)]: false }));
        }, 650);
      }
      setPosts((prev) =>
        prev.map((post) =>
          String(post.id) === String(postId)
            ? {
              ...post,
              is_liked: payload.data.is_liked,
              likes_count: payload.data.likes_count,
            }
            : post,
        ),
      );
    } catch (likeError) {
      setError(likeError.message || "Unable to update like.");
    }
  };

  const toggleCommentsDropdown = (postId) => {
    const key = String(postId);
    setOpenCommentsMap((prev) => ({ ...prev, [key]: !prev[key] }));
    setVisibleCommentCounts((prev) => ({
      ...prev,
      [key]: prev[key] || COMMENTS_PAGE_SIZE,
    }));
  };

  const showMoreComments = (postId, totalComments) => {
    const key = String(postId);
    setVisibleCommentCounts((prev) => ({
      ...prev,
      [key]: Math.min(
        (prev[key] || COMMENTS_PAGE_SIZE) + COMMENTS_PAGE_SIZE,
        totalComments,
      ),
    }));
  };

  const showLessComments = (postId) => {
    setVisibleCommentCounts((prev) => ({
      ...prev,
      [String(postId)]: COMMENTS_PAGE_SIZE,
    }));
  };

  const closePostDetail = () => {
    setSelectedPostId(null);
    setIsPostDetailFullscreen(false);
    setActivePostMenuId(null);
  };

  const togglePostBookmark = (postId) => {
    setBookmarkedPostMap((prev) => {
      const key = String(postId);
      return { ...prev, [key]: !prev[key] };
    });
    setActivePostMenuId(null);
  };

  const openImagePreview = (src, alt) => {
    setSelectedImagePreview({ src, alt });
  };

  const openReportPostModal = (post) => {
    setFeedReportModal({ kind: "post", post });
    setSelectedReportReason("");
    setActivePostMenuId(null);
  };

  const openReportCommentModal = (postId, comment) => {
    setFeedReportModal({ kind: "comment", postId, comment });
    setSelectedReportReason("");
    setFeedCommentMenuOpenKey(null);
  };

  const closeReportModal = () => {
    setFeedReportModal(null);
    setSelectedReportReason("");
  };

  const submitReport = async () => {
    if (!selectedReportReason || !feedReportModal) return;
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Session missing. Please login first.");
      return;
    }
    try {
      let url;
      if (feedReportModal.kind === "post") {
        url = `${apiBaseUrl}/api/feed/${feedReportModal.post.id}/reports`;
      } else {
        url = `${apiBaseUrl}/api/feed/${feedReportModal.postId}/comments/${feedReportModal.comment.id}/reports`;
      }
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: selectedReportReason }),
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to submit report.");
      }
      setNotice(
        "The report has been submitted. We will review it in accordance with our Community Guidelines.",
      );
      closeReportModal();
    } catch (reportError) {
      setError(reportError.message || "Unable to submit report.");
    }
  };

  const handleToggleCommentReaction = async (postId, commentId, reaction) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/feed/${postId}/comments/${commentId}/reaction`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reaction }),
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(
          payload.message || "Unable to update comment reaction.",
        );
      }
      setPosts((prev) =>
        prev.map((post) =>
          String(post.id) === String(postId)
            ? {
              ...post,
              comments: updateCommentInList(
                post.comments || [],
                commentId,
                (comment) => ({
                  ...comment,
                  likes_count: payload.data.likes_count,
                  dislikes_count: payload.data.dislikes_count,
                  current_user_reaction: payload.data.current_user_reaction,
                }),
              ),
            }
            : post,
        ),
      );
    } catch (reactionError) {
      setError(reactionError.message || "Unable to update comment reaction.");
    }
  };

  const handleAddComment = async (event, postId, parentCommentId = null) => {
    event.preventDefault();
    const token = localStorage.getItem("token");
    const draftKey = parentCommentId ? String(parentCommentId) : String(postId);
    const draft = String(
      parentCommentId
        ? replyDrafts[draftKey] || ""
        : commentDrafts[draftKey] || "",
    ).trim();
    if (!token || !draft) return;
    try {
      setError("");
      const response = await fetch(
        `${apiBaseUrl}/api/feed/${postId}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            comment_text: draft,
            parent_comment_id: parentCommentId,
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to add comment.");
      }
      setPosts((prev) =>
        prev.map((post) =>
          String(post.id) === String(postId)
            ? {
              ...post,
              comments_count: payload.data.comments_count,
              comments: [...(post.comments || []), payload.data.comment],
            }
            : post,
        ),
      );
      if (parentCommentId) {
        setReplyDrafts((prev) => ({ ...prev, [draftKey]: "" }));
        setActiveReplyMap((prev) => ({ ...prev, [draftKey]: false }));
      } else {
        setCommentDrafts((prev) => ({ ...prev, [String(postId)]: "" }));
      }
      setOpenCommentsMap((prev) => ({ ...prev, [String(postId)]: true }));
      setVisibleCommentCounts((prev) => ({
        ...prev,
        [String(postId)]: Math.max(
          prev[String(postId)] || COMMENTS_PAGE_SIZE,
          COMMENTS_PAGE_SIZE,
        ),
      }));
    } catch (commentError) {
      setError(commentError.message || "Unable to add comment.");
    }
  };

  const canModifyFeedCommentFn = useCallback(
    (comment) => {
      const role = String(currentUser?.role_name || "").toLowerCase();
      const mod = ["ceo", "admin", "instructor", "trainer"].includes(role);
      const uid = Number(currentUser?.id);
      return mod || (!Number.isNaN(uid) && Number(comment.user_id) === uid);
    },
    [currentUser],
  );

  useEffect(() => {
    if (feedCommentMenuOpenKey === null) return undefined;
    const close = () => setFeedCommentMenuOpenKey(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [feedCommentMenuOpenKey]);

  const handleSaveFeedCommentEdit = async (postId, commentId) => {
    const trimmed = String(feedCommentEditDraft || "").trim();
    const token = localStorage.getItem("token");
    if (!token || !trimmed) return;
    setFeedCommentBusyId(String(commentId));
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/feed/${postId}/comments/${commentId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ comment_text: trimmed }),
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to update comment.");
      }
      const text =
        typeof payload?.data?.comment_text === "string"
          ? payload.data.comment_text
          : trimmed;
      setPosts((prev) =>
        prev.map((post) => {
          if (String(post.id) !== String(postId)) return post;
          return {
            ...post,
            comments: updateCommentInList(
              post.comments || [],
              commentId,
              (c) => ({
                ...c,
                comment_text: text,
              }),
            ),
          };
        }),
      );
      setFeedCommentEditingKey(null);
      setFeedCommentEditDraft("");
    } catch (editErr) {
      setError(editErr.message || "Unable to update comment.");
    } finally {
      setFeedCommentBusyId(null);
    }
  };

  const handleDeleteFeedComment = async (postId, commentId) => {
    if (!window.confirm("Delete this comment and all replies under it?"))
      return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setFeedCommentBusyId(String(commentId));
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/feed/${postId}/comments/${commentId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to delete comment.");
      }
      const deletedCount = Number(payload?.data?.deleted_count ?? 1);
      const nextCount =
        typeof payload?.data?.comments_count === "number"
          ? payload.data.comments_count
          : undefined;
      setPosts((prev) =>
        prev.map((post) => {
          if (String(post.id) !== String(postId)) return post;
          const flat = post.comments || [];
          const idSet = collectDescendantCommentIdsFromFlat(flat, commentId);
          const nextComments = flat.filter((c) => !idSet.has(String(c.id)));
          const comments_count =
            typeof nextCount === "number"
              ? nextCount
              : Math.max(0, Number(post.comments_count || 0) - deletedCount);
          return { ...post, comments: nextComments, comments_count };
        }),
      );
      setFeedCommentEditingKey(null);
      setFeedCommentEditDraft("");
      setActiveReplyMap((prev) => {
        const next = { ...prev };
        delete next[String(commentId)];
        return next;
      });
    } catch (delErr) {
      setError(delErr.message || "Unable to delete comment.");
    } finally {
      setFeedCommentBusyId(null);
    }
  };

  const renderCommentNode = (postId, comment, depth = 0) => {
    const replyKey = String(comment.id);
    const isReplyOpen = Boolean(activeReplyMap[replyKey]);
    const editKey = `${postId}:${comment.id}`;
    const menuKey = editKey;
    const isEditing = feedCommentEditingKey === editKey;
    const busy = feedCommentBusyId === String(comment.id);
    const canModify = canModifyFeedCommentFn(comment);
    const isMenuOpen = feedCommentMenuOpenKey === menuKey;
    return (
      <div key={comment.id} className="student-community-comment-thread">
        <div
          className={`student-community-comment ${depth > 0 ? "is-reply" : ""}`}
        >
          <div className="student-community-avatar mini">
            {getInitial(comment.user_name)}
          </div>
          <div className="student-community-comment-bubble">
            <strong>{comment.user_name || "Member"}</strong>
            {isEditing ? (
              <div className="mt-2">
                <textarea
                  className="form-control form-control-sm"
                  rows={2}
                  value={feedCommentEditDraft}
                  onChange={(event) =>
                    setFeedCommentEditDraft(event.target.value)
                  }
                />
                <div className="d-flex gap-2 mt-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={busy}
                    onClick={() =>
                      handleSaveFeedCommentEdit(postId, comment.id)
                    }
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    disabled={busy}
                    onClick={() => {
                      setFeedCommentEditingKey(null);
                      setFeedCommentEditDraft("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="mb-0">{comment.comment_text}</p>
            )}
            <div className="student-community-comment-reactions">
              <button
                type="button"
                className={
                  comment.current_user_reaction === "like" ? "active" : ""
                }
                onClick={() =>
                  handleToggleCommentReaction(postId, comment.id, "like")
                }
              >
                <FiThumbsUp /> {formatCountLabel(comment.likes_count)}
              </button>
              <button
                type="button"
                className={
                  comment.current_user_reaction === "dislike" ? "active" : ""
                }
                onClick={() =>
                  handleToggleCommentReaction(postId, comment.id, "dislike")
                }
              >
                <FiThumbsDown /> {formatCountLabel(comment.dislikes_count)}
              </button>
              {!isEditing && (
                <div className="comment-actions-menu-wrap">
                  <button
                    type="button"
                    className="comment-actions-toggle"
                    aria-label="Comment actions"
                    aria-expanded={isMenuOpen}
                    aria-haspopup="menu"
                    onClick={(event) => {
                      event.stopPropagation();
                      setFeedCommentMenuOpenKey((cur) =>
                        cur === menuKey ? null : menuKey,
                      );
                    }}
                  >
                    <FiMoreVertical size={18} aria-hidden />
                  </button>
                  {isMenuOpen ? (
                    <div
                      className="comment-actions-menu"
                      role="menu"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveReplyMap((prev) => ({
                            ...prev,
                            [replyKey]: !prev[replyKey],
                          }));
                          setFeedCommentMenuOpenKey(null);
                        }}
                      >
                        <FiMessageCircle
                          style={{ marginRight: 6 }}
                          aria-hidden
                        />{" "}
                        {isReplyOpen ? "Hide reply" : "Reply"}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          openReportCommentModal(postId, comment);
                        }}
                      >
                        <FiFlag style={{ marginRight: 6 }} aria-hidden /> Report
                      </button>
                      {canModify ? (
                        <>
                          <button
                            type="button"
                            role="menuitem"
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFeedCommentEditingKey(editKey);
                              setFeedCommentEditDraft(
                                comment.comment_text || "",
                              );
                              setActiveReplyMap((prev) => ({
                                ...prev,
                                [replyKey]: false,
                              }));
                              setFeedCommentMenuOpenKey(null);
                            }}
                          >
                            <FiEdit2 style={{ marginRight: 6 }} aria-hidden />{" "}
                            Edit
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="text-danger"
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFeedCommentMenuOpenKey(null);
                              handleDeleteFeedComment(postId, comment.id);
                            }}
                          >
                            <FiTrash2 style={{ marginRight: 6 }} aria-hidden />{" "}
                            Delete
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {isReplyOpen && !isEditing && (
              <form
                className="student-community-reply-form"
                onSubmit={(event) =>
                  handleAddComment(event, postId, comment.id)
                }
              >
                <input
                  type="text"
                  value={replyDrafts[replyKey] || ""}
                  onChange={(event) =>
                    setReplyDrafts((prev) => ({
                      ...prev,
                      [replyKey]: event.target.value,
                    }))
                  }
                  className="form-control"
                  placeholder={`Reply to ${comment.user_name || "Member"}...`}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  aria-label="Send reply"
                >
                  <FiSend />
                </button>
              </form>
            )}
          </div>
        </div>

        {comment.replies?.length > 0 && (
          <div className="student-community-replies">
            {comment.replies.map((reply) =>
              renderCommentNode(postId, reply, depth + 1),
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <DashboardSection title={title}>
      <div className="student-community-page">
        <div className="student-community-shell-head">
          <h1>{title}</h1>
          <div className="student-community-toolbar">
            <button
              type="button"
              className="student-community-sparkle"
              aria-label="Highlights"
            >
              ✦
            </button>
            <div className="student-community-sort">
              <button
                type="button"
                className="student-community-sort-btn"
                onClick={() => setShowSortMenu((prev) => !prev)}
              >
                {activeSort} <FiChevronDown />
              </button>
              {showSortMenu && (
                <div className="student-community-sort-menu">
                  {sortOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setActiveSort(option);
                        setShowSortMenu(false);
                      }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className="student-community-new-post"
              onClick={() => setShowComposer((prev) => !prev)}
            >
              New post
            </button>
          </div>
        </div>
        <div className="student-community-filters">
          <img src={sellitStarterImage} alt="Filters" />
        </div>
        <div
          className={`student-community-layout${processingPosts.length > 0 || effectiveShowMembersRail || showFeedInsightsRail
            ? ""
            : " student-community-layout--no-rail"
            }`}
        >
          <section className="student-community-main">


            <button
              type="button"
              className="lms-card student-community-start-post"
              onClick={() => setShowComposer((prev) => !prev)}
            >
              <span className="student-community-avatar small">
                {getInitial(currentUser?.name)}
              </span>
              <span>Start a post</span>
              <span className="student-community-start-plus">
                <FiPlus />
              </span>
            </button>

            {!showComposer && error && (
              <div className="alert alert-danger py-2">{error}</div>
            )}
            {!showComposer && notice && (
              <div className="alert alert-info py-2">{notice}</div>
            )}

            {isLoading ? (
              <div
                className="student-community-skeleton-list"
                aria-label="Loading community feed"
              >
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className="lms-card student-community-skeleton-card"
                  >
                    <div className="student-community-skeleton-head">
                      <span className="student-community-skeleton-avatar" />
                      <div className="flex-grow-1">
                        <span className="student-community-skeleton-line short" />
                        <span className="student-community-skeleton-line tiny" />
                      </div>
                    </div>
                    <span className="student-community-skeleton-line title" />
                    <span className="student-community-skeleton-line" />
                    <span className="student-community-skeleton-line wide" />
                    <div className="student-community-skeleton-media" />
                    <div className="student-community-skeleton-actions">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                ))}
              </div>
            ) : sortedPosts.length === 0 ? (
              <div className="lms-card p-5 text-center">
                <FiImage className="student-community-empty-icon" />
                <h2 className="h5 fw-semibold mt-3">
                  {feedScope === "mine"
                    ? "No posts in My Feed yet"
                    : "No feed posts yet"}
                </h2>
                <p className="text-muted mb-0">
                  {feedScope === "mine"
                    ? "Create a post to see it here."
                    : "Create the first post for your members."}
                </p>
              </div>
            ) : (
              <div className="student-community-feed-list">
                {sortedPosts.map((post) => {
                  const isExpanded = Boolean(expandedPosts[String(post.id)]);
                  const contentPreview = getContentPreview(
                    post.content,
                    isExpanded,
                  );
                  const canExpand =
                    String(post.content || "").trim().length > 180;
                  const comments = Array.isArray(post.comments)
                    ? post.comments
                    : [];
                  const commentTree = buildCommentTree(comments);
                  const postKey = String(post.id);
                  const commentsOpen = Boolean(openCommentsMap[postKey]);
                  const visibleCommentCount =
                    visibleCommentCounts[postKey] || COMMENTS_PAGE_SIZE;
                  const visibleComments = commentTree.slice(
                    0,
                    visibleCommentCount,
                  );
                  const isBlockedPost = Boolean(post.is_blocked);
                  return (
                    <article
                      key={post.id}
                      className={`lms-card student-community-card ${isBlockedPost ? "blocked" : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedPostId(post.id)}
                      onKeyDown={(event) => {
                        if (isInteractiveEventTarget(event.target)) return;
                        if (event.key === "Enter" || event.key === " ")
                          setSelectedPostId(post.id);
                      }}
                    >
                      <div className="student-community-card-top">
                        <div className="d-flex align-items-center gap-2">
                          <div className="student-community-avatar small">
                            {getInitial(post.user_name)}
                          </div>
                          <div>
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              <strong>{post.user_name || "Member"}</strong>
                              <span className="student-community-member-badge">
                                {roleBadge}
                              </span>
                              {isBlockedPost && (
                                <span className="student-community-blocked-badge">
                                  <FiSlash /> Blocked
                                </span>
                              )}
                              <span className="text-muted small">
                                {formatPostDate(post.created_at)}
                              </span>
                            </div>
                            <div className="text-muted small">
                              Posted in Community
                            </div>
                          </div>
                        </div>
                        <div
                          className="student-community-post-menu-wrap"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="student-community-card-icon-btn"
                            aria-label="Post options"
                            title="Post options"
                            onClick={() =>
                              setActivePostMenuId((prev) =>
                                String(prev) === String(post.id)
                                  ? null
                                  : post.id,
                              )
                            }
                          >
                            <FiMoreHorizontal />
                          </button>
                          {String(activePostMenuId) === String(post.id) && (
                            <div className="student-community-post-menu">
                              <button
                                type="button"
                                onClick={() => togglePostBookmark(post.id)}
                              >
                                <FiBookmark />
                                {bookmarkedPostMap[String(post.id)]
                                  ? "Remove bookmark"
                                  : "Add to bookmark"}
                              </button>
                              <button
                                type="button"
                                onClick={() => openReportPostModal(post)}
                              >
                                <FiFlag />
                                Report
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <h2 className="student-community-card-title">
                        {post.heading}
                      </h2>
                      {post.sub_heading && (
                        <p className="student-community-subtitle">
                          {post.sub_heading}
                        </p>
                      )}
                      {isBlockedPost && (
                        <div className="student-community-blocked-reason">
                          <FiSlash />
                          <span>
                            This post is blocked. Reason:{" "}
                            <strong>
                              {post.block_reason ||
                                "Community guideline violation"}
                            </strong>
                          </span>
                        </div>
                      )}
                      {renderMedia(post, openImagePreview)}

                      {contentPreview && (
                        <div className="student-community-content">
                          <p className="mb-0">{contentPreview}</p>
                          {canExpand && (
                            <button
                              type="button"
                              className="student-community-see-more"
                              onClick={(event) => {
                                event.stopPropagation();
                                setExpandedPosts((prev) => ({
                                  ...prev,
                                  [String(post.id)]: !prev[String(post.id)],
                                }));
                              }}
                            >
                              {isExpanded ? "See less" : "See more"}
                            </button>
                          )}
                        </div>
                      )}

                      <div className="student-community-stats">
                        <span>
                          {formatCountLabel(post.comments_count)} comments
                        </span>
                      </div>

                      <div
                        className="student-community-actions"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          className={`${post.is_liked ? "active liked" : ""} ${animatedLikeMap[String(post.id)] ? "like-burst" : ""}`}
                          onClick={() => handleToggleLike(post.id)}
                        >
                          <FiHeart />
                          <span>{formatCountLabel(post.likes_count)}</span>
                        </button>
                        <button
                          type="button"
                          className={commentsOpen ? "active" : ""}
                          onClick={() => toggleCommentsDropdown(post.id)}
                        >
                          <FiMessageCircle /> Comment
                        </button>
                      </div>

                      {commentsOpen && (
                        <div
                          className="student-community-comment-dropdown"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          {commentTree.length > 0 ? (
                            <>
                              <div className="student-community-comments">
                                {visibleComments.map((comment) =>
                                  renderCommentNode(post.id, comment),
                                )}
                              </div>
                              <div className="student-community-comment-pagination">
                                <span>
                                  Showing{" "}
                                  {Math.min(
                                    visibleCommentCount,
                                    commentTree.length,
                                  )}{" "}
                                  of {commentTree.length} threads
                                </span>
                                <div>
                                  {visibleCommentCount < commentTree.length && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        showMoreComments(
                                          post.id,
                                          commentTree.length,
                                        )
                                      }
                                    >
                                      Show 7 more
                                    </button>
                                  )}
                                  {visibleCommentCount > COMMENTS_PAGE_SIZE && (
                                    <button
                                      type="button"
                                      onClick={() => showLessComments(post.id)}
                                    >
                                      Show less
                                    </button>
                                  )}
                                </div>
                              </div>
                            </>
                          ) : (
                            <p className="student-community-no-comments">
                              No comments yet. Start the conversation.
                            </p>
                          )}

                          <form
                            className="student-community-comment-form"
                            onSubmit={(event) =>
                              handleAddComment(event, post.id)
                            }
                          >
                            <input
                              id={`feed-comment-${post.id}`}
                              type="text"
                              value={commentDrafts[String(post.id)] || ""}
                              onChange={(event) =>
                                setCommentDrafts((prev) => ({
                                  ...prev,
                                  [String(post.id)]: event.target.value,
                                }))
                              }
                              className="form-control"
                              placeholder="Write a comment..."
                            />
                            <button
                              type="submit"
                              className="btn btn-primary"
                              aria-label="Send comment"
                            >
                              <FiSend />
                            </button>
                          </form>
                        </div>
                      )}
                    </article>
                  );
                })}
                {isLoadingMore && (
                  <div className="lms-card student-community-skeleton-card">
                    <div className="student-community-skeleton-head">
                      <span className="student-community-skeleton-avatar" />
                      <div className="flex-grow-1">
                        <span className="student-community-skeleton-line short" />
                        <span className="student-community-skeleton-line tiny" />
                      </div>
                    </div>
                    <span className="student-community-skeleton-line title" />
                    <span className="student-community-skeleton-line wide" />
                    <div className="student-community-skeleton-media" />
                  </div>
                )}
                {!hasMoreFeed && sortedPosts.length > 0 && (
                  <div className="student-community-feed-end">
                    You&apos;re all caught up.
                  </div>
                )}
              </div>
            )}
          </section>

          {processingPosts.length > 0 || effectiveShowMembersRail || showFeedInsightsRail ? (
            <aside className="student-community-right-rail">
              {effectiveShowMembersRail && (
                <div className="lms-card student-community-side-card student-community-members-card">
                  <h2>Members</h2>
                  <ul className="list-unstyled mb-0 student-community-members-list">
                    {railMembers.length === 0 ? (
                      <li className="text-muted small py-2">
                        No members loaded yet.
                      </li>
                    ) : (
                      railMembers.map((m, idx) => (
                        <li
                          key={m.id ?? `${m.email}-${idx}`}
                          className="student-community-member-row student-community-member-row--hoverable"
                          onMouseEnter={(event) =>
                            openMemberPopover(m, event.currentTarget, idx)
                          }
                          onMouseLeave={scheduleCloseMemberPopover}
                        >
                          <span className="student-community-avatar small">
                            {getInitial(m.name || m.email || "M")}
                          </span>
                          <div className="student-community-member-meta">
                            <span className="student-community-member-name">
                              {m.name || "Member"}
                            </span>
                            {idx === 0 ? (
                              <span
                                className="student-community-member-chip"
                                title="Community"
                              >
                                M
                              </span>
                            ) : null}
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                  <Link
                    to={membersRailCtaPath}
                    className="student-community-see-members"
                  >
                    {membersRailCtaLabel}
                  </Link>
                </div>
              )}
              {showFeedInsightsRail && (
                <>
                  <div className="lms-card student-community-side-card student-community-events-card">
                    <h2>Upcoming events</h2>
                    <div className="student-community-events-list">
                      {UPCOMING_EVENTS.map((event, index) => (
                        <div
                          key={`${event.month}-${event.day}-${index}`}
                          className="student-community-event-row"
                        >
                          <div className="student-community-event-date">
                            <strong>{event.day}</strong>
                            <span>{event.month}</span>
                          </div>
                          <div className="student-community-event-copy">
                            <h3>{event.title}</h3>
                            <p>{event.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="lms-card student-community-side-card student-community-trending-card">
                    <h2>Trending posts</h2>
                    <div className="student-community-trending-list">
                      {TRENDING_POSTS.map((post) => (
                        <div key={`${post.initials}-${post.title}`} className="student-community-trending-row">
                          <span className={`student-community-trending-avatar tone-${post.tone}`}>
                            {post.initials}
                          </span>
                          <div className="student-community-trending-copy">
                            <h3>{post.title}</h3>
                            <p>{post.author}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {processingPosts.length > 0 && (
                <div className="lms-card student-community-side-card">
                  <h2>Processing posts</h2>
                  <div className="student-community-processing-list">
                    {processingPosts.map((post) => (
                      <div
                        key={post.id}
                        className={`student-community-processing-post ${post.processing_status === "failed" ? "failed" : ""}`}
                      >
                        <span className="student-community-processing-icon">
                          <FiVideo />
                        </span>
                        <div>
                          <strong>{post.heading}</strong>
                          <p>{getProcessingPostProgress(post)}</p>
                          <small>{formatPostDate(post.created_at)}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          ) : null}
        </div>

        <CommentReportReasonModal
          open={Boolean(feedReportModal)}
          title={
            feedReportModal?.kind === "comment" ? "Report comment" : "Report"
          }
          onClose={closeReportModal}
          selectedReason={selectedReportReason}
          onSelectReason={setSelectedReportReason}
          onSubmit={submitReport}
          reasons={REPORT_REASONS}
        />

        {selectedPost && (
          <div
            className="student-community-detail-layer"
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              className="student-community-detail-backdrop"
              aria-label="Close post detail"
              onClick={closePostDetail}
            />
            <button
              type="button"
              className="student-community-detail-nav left"
              aria-label="Previous post"
              disabled={!previousPost}
              onClick={() => previousPost && setSelectedPostId(previousPost.id)}
            >
              ‹
            </button>
            <div
              className={`student-community-detail-modal ${isPostDetailFullscreen ? "fullscreen" : ""}`}
            >
              <div className="student-community-detail-head">
                <h2>{selectedPost.heading}</h2>
                <div className="student-community-detail-tools">
                  <button
                    type="button"
                    className={
                      bookmarkedPostMap[String(selectedPost.id)] ? "active" : ""
                    }
                    aria-label={
                      bookmarkedPostMap[String(selectedPost.id)]
                        ? "Remove bookmark"
                        : "Add to bookmark"
                    }
                    title={
                      bookmarkedPostMap[String(selectedPost.id)]
                        ? "Remove bookmark"
                        : "Add to bookmark"
                    }
                    onClick={() => togglePostBookmark(selectedPost.id)}
                  >
                    <FiBookmark />
                  </button>
                  <button
                    type="button"
                    aria-label={
                      isPostDetailFullscreen
                        ? "Exit full screen"
                        : "Full screen"
                    }
                    title={
                      isPostDetailFullscreen
                        ? "Exit full screen"
                        : "Full screen"
                    }
                    onClick={() => setIsPostDetailFullscreen((prev) => !prev)}
                  >
                    {isPostDetailFullscreen ? <FiMinimize2 /> : <FiMaximize2 />}
                  </button>
                  <div className="student-community-post-menu-wrap">
                    <button
                      type="button"
                      aria-label="Post options"
                      title="Post options"
                      onClick={() =>
                        setActivePostMenuId((prev) =>
                          String(prev) === `detail-${selectedPost.id}`
                            ? null
                            : `detail-${selectedPost.id}`,
                        )
                      }
                    >
                      <FiMoreHorizontal />
                    </button>
                    {String(activePostMenuId) ===
                      `detail-${selectedPost.id}` && (
                        <div className="student-community-post-menu detail">
                          <button
                            type="button"
                            onClick={() => togglePostBookmark(selectedPost.id)}
                          >
                            <FiBookmark />
                            {bookmarkedPostMap[String(selectedPost.id)]
                              ? "Remove bookmark"
                              : "Add to bookmark"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openReportPostModal(selectedPost)}
                          >
                            <FiFlag />
                            Report
                          </button>
                        </div>
                      )}
                  </div>
                  <button
                    type="button"
                    aria-label="Close post detail"
                    onClick={closePostDetail}
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="student-community-detail-body">
                <div className="student-community-card-top">
                  <div className="d-flex align-items-center gap-2">
                    <div className="student-community-avatar small">
                      {getInitial(selectedPost.user_name)}
                    </div>
                    <div>
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <strong>{selectedPost.user_name || "Member"}</strong>
                        <span className="student-community-member-badge">
                          {roleBadge}
                        </span>
                        {selectedPost.is_blocked && (
                          <span className="student-community-blocked-badge">
                            <FiSlash /> Blocked
                          </span>
                        )}
                        <span className="text-muted small">
                          {formatPostDate(selectedPost.created_at)}
                        </span>
                      </div>
                      <div className="text-muted small">
                        Posted in Community
                      </div>
                    </div>
                  </div>
                </div>

                {selectedPost.sub_heading && (
                  <p className="student-community-subtitle">
                    {selectedPost.sub_heading}
                  </p>
                )}
                {selectedPost.content && (
                  <p className="student-community-detail-content">
                    {selectedPost.content}
                  </p>
                )}
                {selectedPost.is_blocked && (
                  <div className="student-community-blocked-reason">
                    <FiSlash />
                    <span>
                      This post is blocked. Reason:{" "}
                      <strong>
                        {selectedPost.block_reason ||
                          "Community guideline violation"}
                      </strong>
                    </span>
                  </div>
                )}
                {renderMedia(selectedPost, openImagePreview)}

                <div className="student-community-stats">
                  <span>
                    {formatCountLabel(selectedPost.comments_count)} comments
                  </span>
                </div>

                <div className="student-community-actions">
                  <button
                    type="button"
                    className={`${selectedPost.is_liked ? "active liked" : ""} ${animatedLikeMap[String(selectedPost.id)] ? "like-burst" : ""}`}
                    onClick={() => handleToggleLike(selectedPost.id)}
                  >
                    <FiHeart />
                    <span>{formatCountLabel(selectedPost.likes_count)}</span>
                  </button>
                  <button type="button" className="active">
                    <FiMessageCircle /> Comment
                  </button>
                </div>

                <div className="student-community-detail-summary">
                  <strong>✦ Conversation summary</strong>
                  <p>
                    Members can read the full post here, react, and continue the
                    discussion with comments and replies.
                  </p>
                </div>

                <div className="student-community-comment-dropdown detail">
                  {selectedPostCommentTree.length > 0 ? (
                    <div className="student-community-comments">
                      {selectedPostCommentTree.map((comment) =>
                        renderCommentNode(selectedPost.id, comment),
                      )}
                    </div>
                  ) : (
                    <p className="student-community-no-comments">
                      No comments yet. Start the conversation.
                    </p>
                  )}
                  <form
                    className="student-community-comment-form"
                    onSubmit={(event) =>
                      handleAddComment(event, selectedPost.id)
                    }
                  >
                    <input
                      type="text"
                      value={commentDrafts[String(selectedPost.id)] || ""}
                      onChange={(event) =>
                        setCommentDrafts((prev) => ({
                          ...prev,
                          [String(selectedPost.id)]: event.target.value,
                        }))
                      }
                      className="form-control"
                      placeholder="What are your thoughts?"
                    />
                    <button
                      type="submit"
                      className="btn btn-primary"
                      aria-label="Send comment"
                    >
                      <FiSend />
                    </button>
                  </form>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="student-community-detail-nav right"
              aria-label="Next post"
              disabled={!nextPost}
              onClick={() => nextPost && setSelectedPostId(nextPost.id)}
            >
              ›
            </button>
          </div>
        )}

        {selectedImagePreview && (
          <div
            className="student-community-image-viewer"
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              className="student-community-image-viewer-backdrop"
              aria-label="Close image preview"
              onClick={() => setSelectedImagePreview(null)}
            />
            <div className="student-community-image-viewer-frame">
              <button
                type="button"
                className="student-community-image-viewer-close"
                aria-label="Close image preview"
                onClick={() => setSelectedImagePreview(null)}
              >
                ×
              </button>
              <ProtectedFeedImage
                src={selectedImagePreview.src}
                alt={selectedImagePreview.alt || "Post image"}
              />
            </div>
          </div>
        )}

        {showComposer && (
          <div className="student-community-modal-layer" role="presentation">
            <button
              type="button"
              className="student-community-modal-backdrop"
              aria-label="Close create post"
              onClick={() => setShowComposer(false)}
            />
            <form
              className="student-community-post-modal"
              onSubmit={handleCreatePost}
            >
              <div className="student-community-post-modal-head">
                <h2>Create post</h2>
                <button
                  type="button"
                  className="student-community-modal-close"
                  aria-label="Close create post"
                  onClick={() => setShowComposer(false)}
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>

              <div className="student-community-post-modal-body">
                {error && (
                  <div className="alert alert-danger py-2">{error}</div>
                )}

                <label
                  className="student-community-modal-label"
                  htmlFor="feed-heading"
                >
                  Heading
                </label>
                <input
                  id="feed-heading"
                  type="text"
                  name="heading"
                  value={formValues.heading}
                  onChange={handleInputChange}
                  className="student-community-modal-title"
                  placeholder="Title (optional)"
                  maxLength={255}
                  required
                />

                <label
                  className="student-community-modal-label"
                  htmlFor="feed-subheading"
                >
                  Sub heading
                </label>
                <input
                  id="feed-subheading"
                  type="text"
                  name="subHeading"
                  value={formValues.subHeading}
                  onChange={handleInputChange}
                  className="student-community-modal-input"
                  placeholder="Add a short sub heading"
                  maxLength={500}
                />

                <textarea
                  id="feed-content"
                  ref={textareaRef}
                  name="content"
                  value={formValues.content}
                  onChange={handleContentChange}
                  onKeyDown={handleContentKeyDown}
                  className="student-community-modal-textarea"
                  placeholder="Write something"
                  rows={7}
                />
                {showCommandMenu && (
                  <div className="student-community-command-menu">
                    {editorCommandGroups.map((group) => (
                      <div
                        key={group.label}
                        className="student-community-command-group"
                      >
                        <h3>{group.label}</h3>
                        {group.items.map((item) => {
                          const Icon = item.Icon;
                          return (
                            <button
                              key={`${group.label}-${item.label}`}
                              type="button"
                              className="student-community-command-item"
                              onClick={() => handleCommandSelect(item)}
                            >
                              <Icon />
                              <span>{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
                {renderMediaPreview()}
              </div>

              <div className="student-community-post-modal-foot">
                <button
                  type="button"
                  className="student-community-modal-tool"
                  title="Insert block"
                  onClick={() => setShowCommandMenu((prev) => !prev)}
                >
                  <FiPlus />
                </button>
                <label
                  className="student-community-modal-tool"
                  htmlFor="feed-media"
                  title="Upload media"
                >
                  <FiUpload />
                </label>
                <input
                  ref={fileInputRef}
                  id="feed-media"
                  type="file"
                  multiple
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip"
                  className="d-none"
                  onChange={handleMediaFileChange}
                />
                {mediaFiles.length > 0 && (
                  <span className="student-community-modal-file">
                    {mediaFiles.length} file{mediaFiles.length > 1 ? "s" : ""}{" "}
                    selected
                  </span>
                )}
                {effectiveFeedSpaceFilter ? (
                  <div className="student-community-posting-space-wrap student-community-posting-space-wrap--locked">
                    <span className="student-community-posting-space-locked">
                      Posting in: <strong>{selectedPostingSpace.title}</strong>
                    </span>
                  </div>
                ) : (
                  <div className="student-community-posting-space-wrap">
                    <button
                      type="button"
                      className="student-community-posting-space-trigger"
                      onClick={() => setPostingSpaceMenuOpen((v) => !v)}
                      aria-expanded={postingSpaceMenuOpen}
                      aria-haspopup="listbox"
                      aria-label={`Posting in ${selectedPostingSpace.title}. Choose space.`}
                    >
                      <span className="student-community-posting-space-trigger-text">
                        Posting in:{" "}
                        <strong>{selectedPostingSpace.title}</strong>
                      </span>
                      <FiChevronDown
                        className={`student-community-posting-space-trigger-chevron${postingSpaceMenuOpen ? " is-open" : ""}`}
                        aria-hidden
                      />
                    </button>
                    {postingSpaceMenuOpen && (
                      <div
                        className="student-community-posting-space-panel"
                        role="listbox"
                        aria-label="Choose posting space"
                      >
                        <input
                          ref={postingSpaceSearchRef}
                          type="search"
                          className="student-community-posting-space-search"
                          placeholder="Search space..."
                          value={postingSpaceSearch}
                          onChange={(e) =>
                            setPostingSpaceSearch(e.target.value)
                          }
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                        {filteredPostingSpaces.length === 0 ? (
                          <p className="student-community-posting-space-empty">
                            No spaces match your search.
                          </p>
                        ) : (
                          <ul className="student-community-posting-space-list">
                            {filteredPostingSpaces.map((space) => (
                              <li key={space.id}>
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={
                                    space.id === selectedPostingSpaceId
                                  }
                                  className={`student-community-posting-space-option${space.id === selectedPostingSpaceId ? " is-active" : ""}`}
                                  onClick={() => {
                                    setSelectedPostingSpaceId(space.id);
                                    setPostingSpaceMenuOpen(false);
                                    setPostingSpaceSearch("");
                                  }}
                                >
                                  <span className="student-community-posting-space-option-inner">
                                    {space.top ? (
                                      <span className="student-community-posting-space-option-kicker">
                                        {space.top}
                                      </span>
                                    ) : null}
                                    <span className="student-community-posting-space-option-main">
                                      {space.emoji ? (
                                        <span
                                          className="student-community-posting-space-option-emoji"
                                          aria-hidden
                                        >
                                          {space.emoji}
                                        </span>
                                      ) : null}
                                      <span className="student-community-posting-space-option-title">
                                        {space.title}
                                      </span>
                                    </span>
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <button
                  type="submit"
                  className="student-community-modal-publish"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Posting..." : "Publish"}
                </button>
              </div>
            </form>
          </div>
        )}
        {feedVariant === "communityHub" ? (
          <Link
            to="/dashboard/student-message"
            className="student-community-fab"
            title="Messages"
            aria-label="Open messages"
          >
            <FiMessageCircle />
          </Link>
        ) : null}
        {effectiveShowMembersRail && memberHoverPopover && typeof document !== "undefined"
          ? createPortal(
            (() => {
              const { member, rect, listIndex } = memberHoverPopover;
              const gap = 14;
              const w = MEMBER_HOVER_CARD_WIDTH;
              let left = rect.left - gap - w;
              if (left < 12) left = rect.right + gap;
              const maxLeft = window.innerWidth - w - 12;
              if (left > maxLeft) left = Math.max(12, maxLeft);
              const top = rect.top + rect.height / 2;
              const tier = resolveMemberStatusTier(member, listIndex);
              const tagline = buildMemberHoverTagline(member);
              return (
                <div
                  key={String(member.id ?? member.email)}
                  className="student-community-member-hover-root"
                  style={{
                    position: "fixed",
                    top,
                    left,
                    width: w,
                    transform: "translateY(-50%)",
                    zIndex: 12060,
                  }}
                  onMouseEnter={keepMemberPopoverOpen}
                  onMouseLeave={scheduleCloseMemberPopover}
                  role="dialog"
                  aria-label={`${member.name || "Member"} profile preview`}
                >
                  <div className="student-community-member-hover-card">
                    <div className="student-community-member-hover-top">
                      <div className="student-community-member-hover-copy">
                        <div className="student-community-member-hover-name">
                          {member.name || "Member"}
                        </div>
                        <p className="student-community-member-hover-tagline">
                          {tagline}
                        </p>
                        <div
                          className="student-community-member-hover-pill"
                          aria-hidden
                        >
                          <FiAward className="student-community-member-hover-trophy" />
                          <span className="student-community-member-hover-tier">
                            {tier}
                          </span>
                          <span className="student-community-member-hover-pill-divider" />
                          <span>Sell It status</span>
                        </div>
                      </div>
                      <div className="student-community-member-hover-avatar-wrap">
                        <div className="student-community-member-hover-avatar-ring">
                          <span className="student-community-member-hover-avatar-letter">
                            {getInitial(
                              member.name || member.email || "M",
                            )}
                          </span>
                        </div>
                        <span className="student-community-member-hover-level-badge">
                          {tier}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="student-community-member-hover-profile-btn"
                      onClick={() => {
                        clearMemberPopoverTimer();
                        setMemberHoverPopover(null);
                        setMemberProfileModalUser(member);
                      }}
                    >
                      <FiUser aria-hidden />
                      <span>View profile</span>
                    </button>
                  </div>
                </div>
              );
            })(),
            document.body,
          )
          : null}
        <MemberProfileModal
          open={Boolean(memberProfileModalUser)}
          summaryMember={memberProfileModalUser}
          onClose={closeMemberProfileModal}
          apiBaseUrl={apiBaseUrl}
          messagesPath={memberProfileMessagesPath}
          showMessageButton={showMemberProfileMessageButton}
          profileCopyPathname={location.pathname}
          profileCopyQueryParam="memberProfile"
        />
      </div>
    </DashboardSection>
  );
}
