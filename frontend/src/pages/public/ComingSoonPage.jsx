import { Link, useSearchParams } from "react-router-dom";
import logo from "../../assets/danielg/logo.png";
import "./danielg-landing.css";

const NAV_LINKS = [
  { label: "Sales Game Book", to: "/coming-soon?feature=Sales%20Game%20Book" },
  { label: "Programs", to: "/coming-soon?feature=Programs" },
  { label: "YouTube", to: "/coming-soon?feature=YouTube" },
  { label: "Speaking", to: "/coming-soon?feature=Speaking" },
  { label: "Free Training", to: "/coming-soon?feature=Free%20Training" },
];

export default function ComingSoonPage() {
  const [params] = useSearchParams();
  const feature = params.get("feature")?.trim() || "This page";

  return (
    <div className="dg-page dg-coming-soon-page">
      <header className="dg-header is-scrolled">
        <div className="dg-header-inner">
          <Link to="/" className="dg-logo-link" aria-label="Daniel G Media home">
            <img src={logo} alt="Daniel G Media" className="dg-logo" />
          </Link>
          <nav className="dg-nav-desktop" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <Link key={link.label} to={link.to} className="dg-nav-link">
                {link.label}
              </Link>
            ))}
            <Link to="/login" className="dg-nav-login">
              Member Login
            </Link>
          </nav>
        </div>
      </header>

      <main className="dg-coming-soon">
        <div className="dg-coming-soon-card">
          <p className="dg-coming-soon-kicker">Coming soon</p>
          <h1>{feature}</h1>
          <p className="dg-coming-soon-copy">
            We&apos;re building this experience. Check back shortly — or head back home to explore
            what&apos;s live now.
          </p>
          <div className="dg-coming-soon-actions">
            <Link to="/" className="dg-btn dg-btn-red">
              Back to home
            </Link>
            <Link to="/dashboard/feed" className="dg-btn dg-btn-soft">
              Student panel
            </Link>
            <Link to="/login" className="dg-btn dg-btn-soft">
              Member Login
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
