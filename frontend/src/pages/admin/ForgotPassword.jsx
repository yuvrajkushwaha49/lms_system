import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import logo from "../../assets/logo.png";
import mobilePreview from "../../assets/mobl_1.png";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const apiBaseUrl = getApiBaseUrl();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [accountNotFound, setAccountNotFound] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setInfo("");
    setNeedsVerification(false);
    setAccountNotFound(false);

    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json();

      if (!response.ok || payload.status !== "success") {
        if (payload.code === "EMAIL_NOT_VERIFIED") {
          setNeedsVerification(true);
        }
        if (payload.code === "ACCOUNT_NOT_FOUND") {
          setAccountNotFound(true);
        }
        throw new Error(payload.message || "Could not send reset link.");
      }

      setInfo(payload.message || "Password reset link sent. Please check your inbox.");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsLoading(false);
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
              <h2>Forgot password</h2>
              <p>We&apos;ll email a reset link to your verified account</p>
            </div>

            {error && <div className="alert alert-danger py-2 mb-4">{error}</div>}
            {info && <div className="alert alert-success py-2 mb-4">{info}</div>}
            {accountNotFound && (
              <div className="mb-4">
                <button
                  type="button"
                  className="btn login-submit-btn w-100"
                  onClick={() => navigate("/register")}
                >
                  Create Account
                </button>
              </div>
            )}
            {needsVerification && (
              <div className="alert alert-warning py-2 mb-4">
                Verify your email first, then come back here. Check your inbox for the verification link.
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form-body">
              <div className="login-field">
                <label htmlFor="email" className="form-label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-control form-control-lg login-input"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>

              <button type="submit" disabled={isLoading} className="btn login-submit-btn">
                {isLoading ? "Sending..." : "Send reset link"}
              </button>

              <p className="login-signup-copy mb-0">
                Remembered it?{" "}
                <button type="button" className="login-signup-link" onClick={() => navigate("/login")}>
                  Back to Login
                </button>
              </p>
              <p className="login-signup-copy">
                Need to verify instead?{" "}
                <Link to="/login" className="login-inline-link">
                  Resend from Login
                </Link>
              </p>
            </form>
          </div>
        </section>
      </section>
    </main>
  );
}
