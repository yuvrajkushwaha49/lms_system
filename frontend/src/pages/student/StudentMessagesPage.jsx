import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import StudentDashboardSectionPage from "./StudentDashboardSectionPage";
import { isDmBlockedMemberId } from "../../utils/blockedDmMembers";

export default function StudentMessagesPage() {
  const [searchParams] = useSearchParams();
  const memberId = Number(searchParams.get("memberId"));
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [composerText, setComposerText] = useState("");
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [openActionMessageId, setOpenActionMessageId] = useState(null);
  const navigate = useNavigate();
  const currentUserId = Number(JSON.parse(localStorage.getItem("user") || "{}")?.id || 0);
  const threadEndRef = useRef(null);
  const actionMenuRef = useRef(null);

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL || "http://localhost:5003").replace(/\/$/, ""),
    [],
  );

  const fetchConversations = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch(`${apiBaseUrl}/api/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to fetch conversations.");
      }
      const rows = Array.isArray(payload.data) ? payload.data : [];
      const filtered = rows.filter((c) => !isDmBlockedMemberId(c.participant_id));
      setConversations(filtered);
      setActiveConversationId((prev) => {
        if (filtered.length === 0) return null;
        if (prev && filtered.some((c) => Number(c.id) === Number(prev))) return prev;
        return Number(filtered[0].id);
      });
    } catch (fetchError) {
      setError(fetchError.message || "Unable to fetch conversations.");
    }
  }, [apiBaseUrl]);

  const ensureConversation = useCallback(async (participantId) => {
    const token = localStorage.getItem("token");
    if (!token || Number.isNaN(participantId)) return null;
    const response = await fetch(`${apiBaseUrl}/api/messages/conversations/ensure`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ participant_id: participantId }),
    });
    const payload = await response.json();
    if (!response.ok || payload.status !== "success") {
      throw new Error(payload.message || "Unable to open conversation.");
    }
    return payload.data || null;
  }, [apiBaseUrl]);

  const fetchMessages = useCallback(async (conversationId) => {
    const token = localStorage.getItem("token");
    if (!token || !conversationId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/messages/conversations/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to fetch messages.");
      }
      setMessages(Array.isArray(payload.data) ? payload.data : []);
    } catch (fetchError) {
      setError(fetchError.message || "Unable to fetch messages.");
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    const timeoutId = window.setTimeout(fetchConversations, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchConversations]);

  useEffect(() => {
    const onBlockUpdated = () => {
      fetchConversations();
    };
    window.addEventListener("lms-dm-block-updated", onBlockUpdated);
    return () => window.removeEventListener("lms-dm-block-updated", onBlockUpdated);
  }, [fetchConversations]);

  useEffect(() => {
    const initialize = async () => {
      if (Number.isNaN(memberId)) return;
      if (isDmBlockedMemberId(memberId)) {
        setError("You have blocked direct messages from this member.");
        return;
      }
      try {
        const conversation = await ensureConversation(memberId);
        if (conversation?.id) {
          setActiveConversationId(Number(conversation.id));
          await fetchConversations();
        }
      } catch (conversationError) {
        setError(conversationError.message || "Unable to open conversation.");
      }
    };
    initialize();
  }, [memberId, ensureConversation, fetchConversations]);

  useEffect(() => {
    if (!activeConversationId) return;
    setReplyingToMessage(null);
    fetchMessages(activeConversationId);
  }, [activeConversationId, fetchMessages]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, activeConversationId]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!actionMenuRef.current?.contains(event.target)) {
        setOpenActionMessageId(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    const markRead = async () => {
      const token = localStorage.getItem("token");
      if (!token || !activeConversationId) return;
      try {
        await fetch(`${apiBaseUrl}/api/messages/conversations/${activeConversationId}/read`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // best effort read receipt update
      }
    };
    markRead();
  }, [activeConversationId, apiBaseUrl, messages.length]);

  const activeConversation = conversations.find((item) => Number(item.id) === Number(activeConversationId)) || null;

  const handleSendMessage = async () => {
    const token = localStorage.getItem("token");
    const text = composerText.trim();
    if (!token || !activeConversationId || !text) return;
    try {
      const response = await fetch(`${apiBaseUrl}/api/messages/conversations/${activeConversationId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message_text: text,
          reply_to_message_id: replyingToMessage?.id || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to send message.");
      }
      setComposerText("");
      setReplyingToMessage(null);
      await fetchMessages(activeConversationId);
      await fetchConversations();
    } catch (sendError) {
      setError(sendError.message || "Unable to send message.");
    }
  };

  const handleStartEdit = (message) => {
    if (!message?.can_edit) return;
    setEditingMessageId(message.id);
    setEditingText(message.message_text || "");
  };

  const handleSaveEdit = async () => {
    const token = localStorage.getItem("token");
    const text = editingText.trim();
    if (!token || !activeConversationId || !editingMessageId || !text) return;
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/messages/conversations/${activeConversationId}/messages/${editingMessageId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ message_text: text }),
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to edit message.");
      }
      setEditingMessageId(null);
      setEditingText("");
      await fetchMessages(activeConversationId);
      await fetchConversations();
    } catch (editError) {
      setError(editError.message || "Unable to edit message.");
    }
  };

  const handleDeleteMessage = async (messageId) => {
    const token = localStorage.getItem("token");
    if (!token || !activeConversationId || !messageId) return;
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/messages/conversations/${activeConversationId}/messages/${messageId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Unable to delete message.");
      }
      if (editingMessageId === messageId) {
        setEditingMessageId(null);
        setEditingText("");
      }
      await fetchMessages(activeConversationId);
      await fetchConversations();
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete message.");
    }
  };


  const formatDate = (value) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const formatTime = (value) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatLongDate = (value) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const formatRelativeTime = (value) => {
    if (!value) return "No activity yet";
    const target = new Date(value);
    if (Number.isNaN(target.getTime())) return "No activity yet";
    const diffMs = Date.now() - target.getTime();
    if (diffMs < 60000) return "Just now";
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months > 1 ? "s" : ""} ago`;
    const years = Math.floor(months / 12);
    return `${years} year${years > 1 ? "s" : ""} ago`;
  };

  return (
    <StudentDashboardSectionPage title="Messages">
      <div className="student-chat-fullscreen-wrap">
        <button
          type="button"
          className="student-chat-backdrop"
          aria-label="Close messages"
          onClick={() => navigate("/dashboard/student-members")}
        />
        <section className="student-chat-shell student-chat-fullscreen lms-card">
          <button
            type="button"
            className="student-chat-close"
            onClick={() => navigate("/dashboard/student-members")}
            aria-label="Close messages"
          >
            ×
          </button>
          <aside className="student-chat-left">
            <div className="student-chat-head">
              <h2 className="h6 fw-semibold mb-0">Direct messages</h2>
            </div>
            <div className="student-bookmark-tabs px-3 border-bottom">
              <button type="button" className="student-bookmark-tab active">Inbox</button>
              <button type="button" className="student-bookmark-tab">Unread</button>
              <button type="button" className="student-bookmark-tab">Agents</button>
            </div>
            <div className="p-3 border-bottom">
              <input className="form-control form-control-sm" placeholder="Search for a name" />
            </div>
            <div className="student-chat-list">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={`student-chat-list-item ${Number(activeConversationId) === Number(conversation.id) ? "active" : ""}`}
                  onClick={() => setActiveConversationId(Number(conversation.id))}
                >
                  <div className="student-member-row-avatar">{String(conversation.participant_name).charAt(0).toUpperCase()}</div>
                  <div className="text-start flex-grow-1">
                    <div className="d-flex align-items-center gap-2">
                      <span className="fw-semibold small">{conversation.participant_name}</span>
                      <small className="text-muted">{formatDate(conversation.latest_message_at)}</small>
                    </div>
                    <p className="mb-0 text-muted small">{conversation.latest_message || "Start conversation..."}</p>
                  </div>
                </button>
              ))}
              {conversations.length === 0 && (
                <p className="text-muted small p-3 mb-0">No conversations yet.</p>
              )}
            </div>
          </aside>

          <main className="student-chat-main">
            <div className="student-chat-main-top">
              <h3 className="h6 fw-semibold mb-0">{activeConversation?.participant_name || "Select a member"}</h3>
            </div>
            <div className="student-chat-main-body">
              {error && <div className="alert alert-danger py-2">{error}</div>}
              {isLoading ? (
                <p className="text-muted mb-0">Loading conversation...</p>
              ) : messages.length === 0 ? (
                <div className="student-chat-empty">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <div className="student-member-row-avatar">{String(activeConversation?.participant_name || "S").charAt(0).toUpperCase()}</div>
                    <div className="student-member-row-avatar">Y</div>
                  </div>
                  <h4 className="h5 mb-2">Start conversation</h4>
                  <p className="text-muted mb-0">
                    This is the very beginning of your direct message history with {activeConversation?.participant_name || "this member"}.
                  </p>
                </div>
              ) : (
                <div className="student-chat-thread">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`student-chat-bubble-row ${Number(message.sender_id) === currentUserId ? "own" : ""}`}
                    >
                      <div className="student-chat-bubble">
                        {editingMessageId === message.id ? (
                          <div className="d-flex flex-column gap-2">
                            <input
                              className="form-control form-control-sm"
                              value={editingText}
                              onChange={(event) => setEditingText(event.target.value)}
                            />
                            <div className="d-flex gap-2 justify-content-end">
                              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEditingMessageId(null)}>
                                Cancel
                              </button>
                              <button type="button" className="btn btn-sm btn-primary" onClick={handleSaveEdit}>
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {message.reply_to_message_id ? (
                              <div className="student-chat-reply-quote">
                                {message.reply_to_message_text || "Original message"}
                              </div>
                            ) : null}
                            <p className="mb-1">{message.is_deleted ? "This message was deleted." : message.message_text}</p>
                            <div className="d-flex align-items-center justify-content-between gap-2">
                              <small className="text-muted student-chat-meta">
                                {formatTime(message.created_at)}
                                {message.edited_at ? " · edited" : ""}
                                {Number(message.sender_id) === currentUserId ? (
                                  <span className={`student-chat-tick ${message.read_at ? "seen" : ""}`}>
                                    {message.read_at ? "✓✓" : "✓"}
                                  </span>
                                ) : null}
                              </small>
                              <div className="d-flex gap-2 align-items-center position-relative">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-link p-0 text-decoration-none student-chat-menu-btn"
                                  onClick={() =>
                                    setOpenActionMessageId((prev) => (prev === message.id ? null : message.id))
                                  }
                                >
                                  ⋯
                                </button>
                                {openActionMessageId === message.id && (
                                  <div className="student-chat-action-menu" ref={actionMenuRef}>
                                    <div className="student-chat-action-list">
                                      <button
                                        type="button"
                                        className="student-chat-action-item"
                                        onClick={() => {
                                          setReplyingToMessage({
                                            id: message.id,
                                            text: message.message_text || "This message was deleted.",
                                          });
                                          setOpenActionMessageId(null);
                                        }}
                                      >
                                        Reply
                                      </button>
                                      <button
                                        type="button"
                                        className="student-chat-action-item"
                                        onClick={async () => {
                                          await navigator.clipboard?.writeText(message.message_text || "");
                                          setOpenActionMessageId(null);
                                        }}
                                      >
                                        Copy
                                      </button>
                                      {message.can_edit && (
                                        <button type="button" className="student-chat-action-item" onClick={() => handleStartEdit(message)}>
                                          Edit
                                        </button>
                                      )}
                                      {message.can_delete && (
                                        <button type="button" className="student-chat-action-item danger" onClick={() => handleDeleteMessage(message.id)}>
                                          Delete
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={threadEndRef} />
                </div>
              )}
            </div>
            <div className="student-chat-composer">
              {replyingToMessage ? (
                <div className="student-chat-replying-bar">
                  <span className="student-chat-replying-text">{replyingToMessage.text}</span>
                  <button
                    type="button"
                    className="student-chat-replying-close"
                    onClick={() => setReplyingToMessage(null)}
                  >
                    ×
                  </button>
                </div>
              ) : null}
              <div className="d-flex gap-2">
                <input
                  className="form-control border-0"
                  placeholder="Type a message..."
                  value={composerText}
                  onChange={(event) => setComposerText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <button type="button" className="btn btn-primary rounded-pill px-3" onClick={handleSendMessage}>
                  Send
                </button>
              </div>
            </div>
          </main>

          <aside className="student-chat-profile">
            <h4 className="h6 fw-semibold mb-3">Profile</h4>
            <div className="d-flex gap-3 mb-3">
              <div className="student-members-avatar">
                {String(activeConversation?.participant_name || "S").trim().charAt(0).toUpperCase()}
              </div>
              <div>
                <h5 className="h6 fw-semibold mb-1">{activeConversation?.participant_name || "Student"}</h5>
                <p className="mb-0 text-muted small">{activeConversation?.participant_email || "student@workians.com"}</p>
              </div>
            </div>
            <div className="student-chat-profile-meta">
              <p><strong>Member since</strong> {formatLongDate(activeConversation?.participant_created_at)}</p>
              <p><strong>Last seen</strong> {formatRelativeTime(activeConversation?.latest_message_at)}</p>
              <p><strong>Company</strong> {activeConversation?.participant_company_name || "-"}</p>
            </div>
          </aside>
        </section>
      </div>
    </StudentDashboardSectionPage>
  );
}

