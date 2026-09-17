import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowRight, FiBookOpen, FiGlobe, FiMic, FiPlay, FiYoutube } from "react-icons/fi";
import logo from "../../assets/danielg/logo.png";
import badge from "../../assets/danielg/badge.png";
import bookCover from "../../assets/danielg/book.png";
import stageImg from "../../assets/danielg/stage.jpeg";
import "./danielg-landing.css";

const NAV_LINKS = [
  { label: "Sales Game Book", to: "/coming-soon?feature=Sales%20Game%20Book" },
  { label: "Programs", to: "/coming-soon?feature=Programs" },
  { label: "YouTube", to: "/coming-soon?feature=YouTube" },
  { label: "Speaking", to: "/coming-soon?feature=Speaking" },
  { label: "Free Training", to: "/coming-soon?feature=Free%20Training" },
];

const HIRE_REASONS = [
  {
    num: "01",
    title: "Unmatched Stage Presence",
    desc: "Daniel possesses the unique ability to not just educate at an elite level, but to entertain and electrify the crowd. He fuses high-octane energy with deep tactical training, keeping your event impactful and memorable from start to finish. This is exactly why he is labeled the World's #1 Sales Trainer.",
  },
  {
    num: "02",
    title: "Seamless Strategic Integration",
    desc: "He molds his strategies to fit your current sales process. Daniel works to incorporate his teachings into your existing framework, aiming to make the training applicable and effective for your specific team.",
  },
  {
    num: "03",
    title: "Lasting Transformation",
    desc: "Daniel focuses on triggering internal breakthroughs by addressing sales insecurities. The goal is to help your team develop a stronger sales identity and work towards lasting improvements in performance.",
  },
];

const INDUSTRIES = [
  "Direct & Door-to-Door Sales",
  "B2B and Real Estate",
  "Insurance, Roofing, and Solar",
  "Network Marketing and Financial Services",
];

const SALES_STATS = [
  { value: "800+", label: "Live Events", detail: "A Decade On Stage" },
  { value: "7M+", label: "Total Following", detail: "Cross-Platform" },
  { value: "2M+", label: "Salespeople Trained", detail: "Prolific Trainer" },
  { value: "480M", label: "Annual Impressions", detail: "Viral Velocity" },
];

const SALES_DREAM = [
  {
    title: "Sales Training Programs",
    desc: "Explore Daniel G programs and sales training certification resources.",
    href: "https://certified.danielgmedia.com",
    Icon: FiBookOpen,
  },
  {
    title: "Sales Training Events",
    desc: "Bring Daniel G to your next sales meeting, company event, or team training.",
    href: "https://speaking.danielgmedia.com",
    Icon: FiMic,
  },
  {
    title: "Daniel G Videos",
    desc: "Watch sales training videos, interviews, and practical selling insights.",
    href: "https://www.youtube.com/@DanielGShow",
    Icon: FiYoutube,
  },
  {
    title: "Free Live Training",
    desc: "Join Daniel G online for a free live sales training session this Friday.",
    href: "https://spiritual.danielgmedia.com",
    Icon: FiGlobe,
  },
];

const BOOK_POINTS = [
  "The complete N.R.S. formula — handle objections with ease and close without pressure",
  "Word-for-word scripts to stimulate referrals and build a pipeline of eager buyers",
  "The revolutionary referral method Daniel only shared with his most exclusive clients",
  "How one client added $420,000 in income in just 60 days using one strategy from this book",
];

const YT_THUMBS = [
  "https://files.manuscdn.com/user_upload_by_module/session_file/310519663092347187/CtukcfxxPxckrLRi.png",
  stageImg,
];

const HERO_VIDEO = "https://danielgmedia.com/manus-storage/ewfwefwfe_a8e67c35.mp4";

export default function DanielGLandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="dg-page">
      <header className={`dg-header${scrolled ? " is-scrolled" : ""}`}>
        <div className="dg-header-inner">
          <a href="#top" className="dg-logo-link" aria-label="Daniel G Media home">
            <img src={logo} alt="Daniel G Media" className="dg-logo" />
          </a>
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

      <main id="top">
        <section className="dg-hero">
          <div className="dg-hero-media" aria-hidden="true">
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              src={HERO_VIDEO}
              poster={stageImg}
            />
            <div className="dg-hero-dim" />
            <div className="dg-hero-redline" />
          </div>
          <div className="dg-hero-content">
            <div className="dg-hero-title-wrap">
              <h1 className="dg-hero-title">DANIEL G</h1>
              <img src={badge} alt="World Class Sales Trainer" className="dg-hero-badge" />
            </div>
            <h2 className="dg-hero-sub">
              LABELED WORLD&apos;S NUMBER <span>1</span>
              <br />
              SALES TRAINER OF 2026
            </h2>
            <div className="dg-hero-ctas">
              <a
                href="https://speaking.danielgmedia.com"
                target="_blank"
                rel="noopener noreferrer"
                className="dg-btn dg-btn-red-outline"
              >
                Hire for Speaking
              </a>
              <a
                href="https://certified.danielgmedia.com"
                target="_blank"
                rel="noopener noreferrer"
                className="dg-btn dg-btn-white-outline"
              >
                Get Certified
              </a>
            </div>
          </div>
          <p className="dg-scroll-hint">Scroll to Explore</p>
        </section>

        <section className="dg-live">
          <div className="dg-live-glow" aria-hidden="true" />
          <div className="dg-container">
            <div className="dg-live-card">
              <div>
                <p className="dg-eyebrow">Free Live Training · This Friday</p>
                <h2 className="dg-h2">
                  Join the Free
                  <br />
                  <span className="dg-red">Live Training</span>
                </h2>
                <p className="dg-copy">
                  Join Daniel G for a live online training this Friday. Reserve your free place and
                  learn directly from one of the world&apos;s leading sales trainers.
                </p>
              </div>
              <div className="dg-live-side">
                <p className="dg-live-seat">Your free seat is waiting.</p>
                <p className="dg-live-meta">Live online · This Friday</p>
                <a
                  href="https://spiritual.danielgmedia.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dg-btn dg-btn-white-outline dg-btn-block"
                >
                  Reserve Free Spot <FiArrowRight aria-hidden />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="dg-about dg-section">
          <div className="dg-container dg-about-grid">
            <div>
              <h2 className="dg-h2">
                About <span className="dg-red">Daniel G</span>
              </h2>
              <p className="dg-copy">
                Daniel Guaragna, known professionally as Daniel G, is the Owner and Founder of World
                Class Sales Training — widely recognized as the{" "}
                <strong>pioneer of sales training on social media</strong>. He started selling
                door-to-door at 14 years old and spent the next two decades mastering every facet of
                the sales process, from the cold approach to the close.
              </p>
              <p className="dg-copy">
                Today, Daniel has delivered over <strong>800+ keynotes</strong> across 27 countries,
                trained <strong>2 million+ sales professionals</strong> in over 25 industries, and
                built one of the most engaged sales communities on the internet with{" "}
                <strong>7 million+ followers</strong> across platforms.
              </p>
              <blockquote className="dg-quote">
                Sales is a game. Master it — and make it look effortless.
              </blockquote>
            </div>
            <div className="dg-about-visual">
              <img src={stageImg} alt="Daniel G on stage" />
            </div>
          </div>
        </section>

        <section className="dg-stats dg-section">
          <div className="dg-container">
            <div className="dg-stats-head">
              <h2 className="dg-h2">Sales Stats</h2>
              <p className="dg-stats-sub">Unrivaled Reach — Data Verified 2025</p>
            </div>
            <div className="dg-stats-grid">
              {SALES_STATS.map((stat) => (
                <article key={stat.label} className="dg-stat-card">
                  <p className="dg-stat-value">{stat.value}</p>
                  <p className="dg-stat-label">{stat.label}</p>
                  <p className="dg-stat-detail">{stat.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="dg-dream dg-section">
          <div className="dg-container">
            <div className="dg-dream-head">
              <p className="dg-dream-kicker">Sales Dream · Daniel G Sales Training</p>
              <h2 className="dg-dream-title">
                Sales Training Programs,{" "}
                <span>Events &amp; Videos</span>
              </h2>
              <p className="dg-dream-intro">
                Sales Dream is the Daniel G Media training ecosystem. Explore sales training programs,
                live team training, speaking events, and Daniel G videos designed to help sales
                professionals and organizations develop practical sales skills.
              </p>
            </div>
            <div className="dg-dream-grid">
              {SALES_DREAM.map((item) => (
                <a
                  key={item.title}
                  className="dg-dream-card"
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  <item.Icon className="dg-dream-icon" aria-hidden="true" />
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                  <span className="dg-dream-explore">
                    Explore <FiArrowRight aria-hidden="true" />
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="dg-hire dg-section">
          <div className="dg-hire-media" aria-hidden="true">
            <video autoPlay muted loop playsInline preload="metadata" src={HERO_VIDEO} poster={stageImg} />
            <div className="dg-hire-dim" />
          </div>
          <div className="dg-container dg-hire-grid">
            <div>
              <h2 className="dg-h2">Hire Daniel G to train at your next event or your team.</h2>
              <div className="dg-rule" />
              <h3 className="dg-h3">3 Reasons to Book Him Now</h3>
              <p className="dg-copy">Hire Daniel G to train your organization in person or online.</p>
            </div>
            <div className="dg-reasons">
              {HIRE_REASONS.map((item) => (
                <div key={item.num} className="dg-reason">
                  <span className="dg-reason-num">{item.num}</span>
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.desc}</p>
                  </div>
                </div>
              ))}
              <a
                href="https://speaking.danielgmedia.com"
                target="_blank"
                rel="noopener noreferrer"
                className="dg-btn dg-btn-white-outline dg-btn-block"
              >
                Book Daniel G Now
              </a>
            </div>
          </div>
        </section>

        <section className="dg-industry dg-section">
          <div className="dg-container dg-industry-inner">
            <h2 className="dg-h2">
              Industry <span className="dg-red">Expertise</span>
            </h2>
            <p className="dg-copy">
              From local startups to massive corporations, Daniel has optimized sales processes for
              over 25 industries. His expertise is highly sought after in sectors including:
            </p>
            <ul className="dg-industry-list">
              {INDUSTRIES.map((item) => (
                <li key={item}>
                  <span className="dg-dot" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="dg-youtube dg-section">
          <div className="dg-container">
            <div className="dg-section-head">
              <h2 className="dg-h2">
                Watch Daniel G on <span className="dg-red">YouTube</span>
              </h2>
              <div className="dg-rule dg-rule-center" />
            </div>
            <div className="dg-yt-grid">
              {YT_THUMBS.map((src, i) => (
                <a
                  key={src}
                  href="https://www.youtube.com/@DanielGShow"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dg-yt-card"
                >
                  <img src={src} alt={`Daniel G YouTube video ${i + 1}`} />
                  <span className="dg-yt-play" aria-hidden>
                    <FiPlay />
                  </span>
                </a>
              ))}
            </div>
            <div className="dg-center">
              <a
                href="https://www.youtube.com/@DanielGShow"
                target="_blank"
                rel="noopener noreferrer"
                className="dg-btn dg-btn-red-outline"
              >
                Watch on YouTube
              </a>
            </div>
          </div>
        </section>

        <section className="dg-book dg-section">
          <div className="dg-container dg-book-grid">
            <div className="dg-book-cover">
              <img src={bookCover} alt="The Sales Game book cover" />
            </div>
            <div>
              <p className="dg-eyebrow">Exclusive Offer</p>
              <h2 className="dg-h2">
                Get The Sales Game Book + 7 Days Free Access
              </h2>
              <p className="dg-copy">
                Join Daniel G as he goes live every month on Zoom to train you on how to reinforce
                your sales message until it becomes almost second nature. Learn to implement his
                N.R.S. (No Resistance Sales) formula without being sleazy or pushy.
              </p>
              <div className="dg-book-box">
                <h3>What You&apos;ll Discover Inside:</h3>
                <ul>
                  {BOOK_POINTS.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
              <a
                href="https://book.danielgmedia.com"
                target="_blank"
                rel="noopener noreferrer"
                className="dg-btn dg-btn-red dg-btn-block"
              >
                Get The Book Now
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="dg-footer">
        <p className="dg-footer-copy">© 2026 WORLD CLASS SALES AGENCY LLC ALL RIGHTS RESERVED.</p>
        <div className="dg-footer-links">
          <a href="https://danielgterms.com" target="_blank" rel="noopener noreferrer">
            Terms and Conditions
          </a>
          <a href="https://danielgterms.com" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </a>
          <Link to="/login">Member Login</Link>
        </div>
        <p className="dg-footer-disclaimer">
          DISCLAIMER: The results mentioned on this website are aspirational and do not guarantee
          that you will achieve the same results. Your individual results will depend on your
          dedication, background, and motivation.
        </p>
      </footer>
    </div>
  );
}
