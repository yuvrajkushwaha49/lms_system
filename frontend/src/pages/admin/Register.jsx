import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../../assets/logo.png";
import mobilePreview from "../../assets/mobl_1.png";

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    business_name: "",
    org_name: "",
    email: "",
    phone: "",
    address: "",
    ceo_name: "",
    password: "",
    confirm_password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const apiBaseUrl = (
    import.meta.env.VITE_API_BASE_URL || "http://localhost:5003"
  ).replace(/\/$/, "");

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (formData.password !== formData.confirm_password) {
        throw new Error("Password and Confirm Password do not match.");
      }

      const payloadToSend = {
        business_name: formData.business_name,
        org_name: formData.org_name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        ceo_name: formData.ceo_name,
        password: formData.password,
      };

      const response = await fetch(`${apiBaseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadToSend),
      });

      const payload = await response.json();

      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Registration failed");
      }

      navigate("/login");
    } catch (registerError) {
      setError(registerError.message);
    } finally {
      setIsLoading(false);
    }
  };

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
              <p>Register your business to get started</p>
            </div>

            {error && <div className="alert alert-danger py-2 mb-4">{error}</div>}

            <form onSubmit={handleRegister} className="login-form-body register-form-body">
              <div className="register-grid">
                <div className="login-field">
                  <label htmlFor="business_name" className="form-label">
                    Business Name
                  </label>
                  <input
                    id="business_name"
                    type="text"
                    name="business_name"
                    value={formData.business_name}
                    onChange={handleChange}
                    className="form-control form-control-lg login-input"
                    placeholder="Enter business name"
                    required
                  />
                </div>

                <div className="login-field">
                  <label htmlFor="org_name" className="form-label">
                    Organization Name
                  </label>
                  <input
                    id="org_name"
                    type="text"
                    name="org_name"
                    value={formData.org_name}
                    onChange={handleChange}
                    className="form-control form-control-lg login-input"
                    placeholder="Enter organization name"
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
                    placeholder="admin@gmail.com"
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
                    required
                  />
                </div>

                <div className="login-field register-grid-full">
                  <label htmlFor="address" className="form-label">
                    Address
                  </label>
                  <input
                    id="address"
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="form-control form-control-lg login-input"
                    placeholder="Enter business address"
                    required
                  />
                </div>

                <div className="login-field">
                  <label htmlFor="ceo_name" className="form-label">
                    CEO Name
                  </label>
                  <input
                    id="ceo_name"
                    type="text"
                    name="ceo_name"
                    value={formData.ceo_name}
                    onChange={handleChange}
                    className="form-control form-control-lg login-input"
                    placeholder="Enter CEO name"
                    required
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

                <div className="login-field register-grid-full">
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
                {isLoading ? "Creating Account..." : "Register Now"}
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

