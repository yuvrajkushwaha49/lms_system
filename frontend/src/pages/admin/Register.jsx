import { useState } from "react";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

import { Link, useNavigate } from "react-router-dom";
import logo from "../../assets/logo.png";
import mobilePreview from "../../assets/mobl_1.png";

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirm_password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [registerMessage, setRegisterMessage] = useState("");
  const [resendBusy, setResendBusy] = useState(false);
  const [resendNote, setResendNote] = useState("");
  const [resendError, setResendError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const apiBaseUrl = getApiBaseUrl();

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleResendVerification = async () => {
    if (!registeredEmail || resendBusy) return;
    setResendBusy(true);
    setResendNote("");
    setResendError("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: registeredEmail }),
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Could not resend verification email.");
      }
      setResendNote(payload.message || "Verification email sent. Please check your inbox.");
    } catch (resendErr) {
      setResendError(resendErr.message);
    } finally {
      setResendBusy(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (formData.password !== formData.confirm_password) {
        throw new Error("Password and Confirm Password do not match.");
      }

      const payloadToSend = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
      };

      const response = await fetch(`${apiBaseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadToSend),
      });

      const payload = await response.json();

      if (!response.ok || payload.status !== "success") {
        if (payload.code === "EMAIL_ALREADY_VERIFIED") {
          throw new Error(
            payload.message ||
              "This email is already verified. Please log in or use Forgot Password.",
          );
        }
        throw new Error(payload.message || "Registration failed");
      }

      setRegisteredEmail(payload?.data?.email || formData.email);
      setRegisterMessage(
        payload.message ||
          "Account created. Please check your email and verify before logging in.",
      );
      setResendNote("");
      setResendError("");
    } catch (registerError) {
      setError(registerError.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (registeredEmail) {
    return (
      <main className="login-shell register-shell">
        <div className="login-pattern login-pattern-left" aria-hidden="true" />
        <div className="login-pattern login-pattern-right" aria-hidden="true" />
        <section className="login-stage register-stage">
          <section className="login-form-panel" style={{ margin: "0 auto" }}>
            <div className="login-form-card register-form-card">
              <div className="login-form-head register-form-head">
                <h2>Check your email</h2>
                <p>Verify your account to finish signup</p>
              </div>
              <div className="alert alert-success py-2 mb-4">{registerMessage}</div>
              {resendNote && <div className="alert alert-success py-2 mb-4">{resendNote}</div>}
              {resendError && <div className="alert alert-danger py-2 mb-4">{resendError}</div>}
              <p className="mb-3">
                We sent a verification link to <strong>{registeredEmail}</strong>. Open that
                email and click <strong>Verify email</strong>, then come back to log in.
              </p>
              <div className="d-flex flex-column gap-2">
                <button
                  type="button"
                  className="btn btn-outline-primary w-100"
                  disabled={resendBusy}
                  onClick={handleResendVerification}
                >
                  {resendBusy ? "Sending..." : "Resend verification link"}
                </button>
                <button type="button" className="btn login-submit-btn" onClick={() => navigate("/login")}>
                  Go to Login
                </button>
              </div>
              <p className="login-signup-copy register-login-copy mt-3 mb-0">
                Didn&apos;t get the email? Click <strong>Resend verification link</strong> above.
              </p>
            </div>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="login-shell register-shell">
      <div className="login-pattern login-pattern-left" aria-hidden="true" />
      <div className="login-pattern login-pattern-right" aria-hidden="true" />
      <div className="login-circle login-circle-top" aria-hidden="true" />
      <div className="login-circle login-circle-bottom" aria-hidden="true" />

      <section className="login-stage register-stage">
        <aside className="login-visual-panel">
          <img src={logo} alt="Workians Realty" className="login-page-logo" />

          <div className="login-phone-showcase">
            <div className="login-ring login-ring-outer" aria-hidden="true" />
            <div className="login-ring login-ring-mid" aria-hidden="true" />
            <div className="login-ring login-ring-inner" aria-hidden="true" />

            <span className="login-pin login-pin-1" aria-hidden="true" />
            <span className="login-pin login-pin-2" aria-hidden="true" />
            <span className="login-pin login-pin-3" aria-hidden="true" />
            <span className="login-pin login-pin-4" aria-hidden="true" />
            <span className="login-pin login-pin-5" aria-hidden="true" />
            <span className="login-pin login-pin-6" aria-hidden="true" />

            <img src={mobilePreview} alt="Mobile app preview" className="login-phone-image" />
          </div>
        </aside>

        <section className="login-form-panel">
          <div className="login-form-card register-form-card">
            <div className="login-form-head register-form-head">
              <h2>Create Account</h2>
              <p>Sign up as a student to access your learning panel</p>
            </div>

            {error && (
              <div className="alert alert-danger py-2 mb-4">
                {error}
                {/forgot password/i.test(error) && (
                  <div className="mt-2">
                    <Link to="/forgot-password" className="login-inline-link">
                      Go to Forgot Password
                    </Link>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleRegister} className="login-form-body register-form-body">
              <div className="register-grid">
                <div className="login-field register-grid-full">
                  <label htmlFor="name" className="form-label">
                    Full Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="form-control form-control-lg login-input"
                    placeholder="Enter your full name"
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="login-field">
                  <label htmlFor="email" className="form-label">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="form-control form-control-lg login-input"
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="login-field">
                  <label htmlFor="phone" className="form-label">
                    Phone
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="form-control form-control-lg login-input"
                    placeholder="Enter phone number"
                    autoComplete="tel"
                  />
                </div>

                <div className="login-field">
                  <label htmlFor="password" className="form-label">
                    Password
                  </label>
                  <div className="login-password-wrap">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="form-control form-control-lg login-input login-password-input"
                      placeholder="Create password"
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
                    Confirm Password
                  </label>
                  <div className="login-password-wrap">
                    <input
                      id="confirm_password"
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirm_password"
                      value={formData.confirm_password}
                      onChange={handleChange}
                      className="form-control form-control-lg login-input login-password-input"
                      placeholder="Confirm password"
                      autoComplete="new-password"
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      className="login-password-toggle"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    >
                      {showConfirmPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn login-submit-btn register-submit-btn"
              >
                {isLoading ? "Creating Account..." : "Create Student Account"}
              </button>

              <p className="login-signup-copy register-login-copy">
                Already have an account?{" "}
                <Link to="/login" className="login-inline-link">
                  Login
                </Link>
              </p>
            </form>
          </div>
        </section>
      </section>
    </main>
  );
}
