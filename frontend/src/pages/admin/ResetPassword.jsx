import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import logo from "../../assets/logo.png";
import mobilePreview from "../../assets/mobl_1.png";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = String(searchParams.get("token") || "").trim();
  const apiBaseUrl = getApiBaseUrl();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(token ? "" : "Reset token is missing from the link.");
  const [info, setInfo] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setInfo("");

    try {
      if (password !== confirmPassword) {
        throw new Error("Password and Confirm Password do not match.");
      }

      const response = await fetch(`${apiBaseUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
          confirm_password: confirmPassword,
        }),
      });
      const payload = await response.json();

      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Could not reset password.");
      }

      setInfo(payload.message || "Password updated. You can log in now.");
      setTimeout(() => navigate("/login"), 1500);
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
              <h2>Reset password</h2>
              <p>Choose a new password for your account</p>
            </div>

            {error && <div className="alert alert-danger py-2 mb-4">{error}</div>}
            {info && <div className="alert alert-success py-2 mb-4">{info}</div>}

            {token ? (
              <form onSubmit={handleSubmit} className="login-form-body">
                <div className="login-field">
                  <label htmlFor="password" className="form-label">
                    New password
                  </label>
                  <div className="login-password-wrap">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="form-control form-control-lg login-input login-password-input"
                      placeholder="Enter new password"
                      autoComplete="new-password"
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      className="login-password-toggle"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div className="login-field">
                  <label htmlFor="confirm_password" className="form-label">
                    Confirm password
                  </label>
                  <input
                    id="confirm_password"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="form-control form-control-lg login-input"
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </div>

                <button type="submit" disabled={isLoading} className="btn login-submit-btn">
                  {isLoading ? "Updating..." : "Update password"}
                </button>
              </form>
            ) : null}

            <p className="login-signup-copy mt-3 mb-0">
              <Link to="/forgot-password" className="login-inline-link">
                Request a new reset link
              </Link>
              {" · "}
              <Link to="/login" className="login-inline-link">
                Login
              </Link>
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
