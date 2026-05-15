import { useState } from 'react';
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

import { Link, useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';
import mobilePreview from '../../assets/mobl_1.png';

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const apiBaseUrl = getApiBaseUrl();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const payload = await response.json();

      if (!response.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Login failed. Please verify credentials.');
      }

      localStorage.setItem('token', payload.data.token);
      localStorage.setItem('user', JSON.stringify(payload.data.user));

      const roleName = String(payload?.data?.user?.role_name || '').toLowerCase();

      if (roleName === 'student') {
        navigate('/dashboard/student-community');
      } else if (roleName === 'instructor' || roleName === 'trainer') {
        navigate('/dashboard/trainer-dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (loginError) {
      setError(loginError.message);
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
            <div className="login-ring login-ring-outer" aria-hidden="true" />
            <div className="login-ring login-ring-mid" aria-hidden="true" />
            <div className="login-ring login-ring-innero" aria-hidden="true" />
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
          <div className="login-form-card">
            <div className="login-form-head">
              <h2>Welcome Back</h2>
              <p>Please login your account</p>
            </div>

            {error && <div className="alert alert-danger py-2 mb-4">{error}</div>}

            <form onSubmit={handleLogin} className="login-form-body">
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
                <div className="login-label-row">
                  <label htmlFor="password" className="form-label">
                    Password
                  </label>
                </div>

                <div className="login-password-wrap">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="form-control form-control-lg login-input login-password-input"
                    placeholder="enter your password"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn login-submit-btn"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>

              <div className="login-forgot-row">
                <Link to="/forgot-password" className="login-inline-link">
                  Forgot Password
                </Link>
              </div>
              <p className="login-signup-copy">
                Didn&apos;t have an Account?{' '}
                <button
                  type="button"
                  className="login-signup-link"
                  onClick={() => navigate('/register')}
                >
                  Sign-up
                </button>
              </p>





            </form>
          </div>
        </section>
      </section>
    </main>
  );
}

