import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import logo from "../../assets/logo.png";
import mobilePreview from "../../assets/mobl_1.png";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = String(searchParams.get("token") || "").trim();
  const apiBaseUrl = getApiBaseUrl();

  const [status, setStatus] = useState(token ? "loading" : "missing");
  const [message, setMessage] = useState(
    token ? "Verifying your email..." : "Verification token is missing.",
  );
  const [email, setEmail] = useState("");
  const [resendBusy, setResendBusy] = useState(false);
  const [resendNote, setResendNote] = useState("");

  useEffect(() => {
    if (!token) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`,
        );
        const payload = await response.json();
        if (cancelled) return;

        if (!response.ok || payload.status !== "success") {
          setStatus(payload.code === "TOKEN_EXPIRED" ? "expired" : "error");
          setMessage(payload.message || "Verification failed.");
          setEmail(payload?.data?.email || "");
          return;
        }

        setStatus("success");
        setMessage(payload.message || "Email verified successfully.");
        setEmail(payload?.data?.email || "");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Could not verify email. Please try again.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, token]);

  const handleResend = async () => {
    if (!email) return;
    setResendBusy(true);
    setResendNote("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json();
      setResendNote(payload.message || "If needed, a new verification email was sent.");
    } catch {
      setResendNote("Could not resend verification email.");
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <main className="login-shell">
      <div className="login-pattern login-pattern-left" aria-hidden="true" />
      <div className="login-pattern login-pattern-right" aria-hidden="true" />
      <div className="login-circle login-circle-top" aria-hidden="true" />
      <div className="login-circle login-circle-bottom" aria-hidden="true" />

      <section className="login-stage">
        <aside className="login-visual-panel">
          <img src={logo} alt="Workians Realty" className="login-page-logo" />
          <div className="login-phone-showcase">
            <img src={mobilePreview} alt="Mobile app preview" className="login-phone-image" />
          </div>
        </aside>

        <section className="login-form-panel">
          <div className="login-form-card">
            <div className="login-form-head">
              <h2>Email verification</h2>
              <p>Confirm your account email to continue</p>
            </div>

            {status === "loading" && <div className="alert alert-info py-2 mb-4">{message}</div>}
            {status === "success" && <div className="alert alert-success py-2 mb-4">{message}</div>}
            {(status === "error" || status === "missing" || status === "expired") && (
              <div className="alert alert-danger py-2 mb-4">{message}</div>
            )}
            {resendNote && <div className="alert alert-secondary py-2 mb-4">{resendNote}</div>}

            <div className="d-flex flex-column gap-2">
              {status === "success" && (
                <button type="button" className="btn login-submit-btn" onClick={() => navigate("/login")}>
                  Go to Login
                </button>
              )}

              {(status === "expired" || status === "error") && email && (
                <button
                  type="button"
                  className="btn login-submit-btn"
                  disabled={resendBusy}
                  onClick={handleResend}
                >
                  {resendBusy ? "Sending..." : "Resend verification email"}
                </button>
              )}

              <p className="login-signup-copy mb-0">
                <Link to="/login" className="login-inline-link">
                  Back to Login
                </Link>
              </p>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
