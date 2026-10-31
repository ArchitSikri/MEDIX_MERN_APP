import { ArrowUpRight, Stethoscope, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Brand } from '../components/AuthPage.jsx'

const destinations = [
  {
    label: 'Register as a doctor',
    detail: 'For healthcare professionals',
    path: '/doctor/register',
    icon: Stethoscope
  },
  {
    label: 'Login as a doctor',
    detail: 'Your professional account',
    path: '/doctor/login',
    icon: Stethoscope
  },
  {
    label: 'Register as a user',
    detail: 'Start your care journey',
    path: '/user/register',
    icon: UserRound
  },
  {
    label: 'Login as a user',
    detail: 'Return to your account',
    path: '/user/login',
    icon: UserRound
  }
]

export default function Home() {
  return (
    <main className="home-page">
      <header className="site-header">
        <Brand />
        <span className="header-note">
          <i className="ri-heart-pulse-line" aria-hidden="true" />
          Care, considered.
        </span>
      </header>

      <section className="home-content">
        <div className="home-intro">
          <span className="home-eyebrow">A BETTER WAY TO CONNECT WITH CARE</span>
          <h1>
            Your health,
            <br />
            <em>held with care.</em>
          </h1>
          <p>
            A thoughtful place for the people who give care
            and the people who need it.
          </p>
          <div className="home-signature">
            <span className="signature-line" />
            <span>Care begins here</span>
          </div>
        </div>

        <nav className="destination-list" aria-label="Choose your account">
          <div className="destination-heading">
            <span>WELCOME TO MEDIX</span>
            <span>01 — 04</span>
          </div>
          {destinations.map(({ label, detail, path, icon: Icon }, index) => (
            <Link className="destination-link" key={path} to={path}>
              <span className="destination-icon" aria-hidden="true">
                <Icon size={18} strokeWidth={1.6} />
              </span>
              <span className="destination-copy">
                <span className="destination-label">{label}</span>
                <span className="destination-detail">{detail}</span>
              </span>
              <span className="destination-index">0{index + 1}</span>
              <ArrowUpRight className="destination-arrow" size={18} strokeWidth={1.7} aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </section>

      <footer className="site-footer">
        <span>© {new Date().getFullYear()} Medix Health</span>
        <span>Thoughtful care. Human connection.</span>
        <span className="footer-location">Made with care <span aria-hidden="true">·</span> For everyone</span>
      </footer>
    </main>
  )
}