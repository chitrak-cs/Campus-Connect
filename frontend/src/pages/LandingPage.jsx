import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, FileText, MessageSquare, Users, ShieldCheck, ArrowRight, Github, Upload, Search, Sparkles } from 'lucide-react'
import api from '../utils/api'
import { Button, Skeleton } from '../components/ui'
import '../styles/pages/landing.css'

const FEATURES = [
  { icon: FileText, title: 'Notes and papers', text: 'Browse lecture notes, past papers and assignments by department and year.' },
  { icon: MessageSquare, title: 'Real-time chat', text: 'Talk with classmates and faculty in a campus-wide room or your own groups.' },
  { icon: Users, title: 'Study groups', text: 'Create public groups, or private ones that people join with an invite code.' },
  { icon: ShieldCheck, title: 'Moderated by admins', text: 'Every student upload is reviewed before it appears, so the library stays useful.' },
]
const STEPS = [
  { icon: Sparkles, title: 'Create an account', text: 'Sign up with your email and confirm it with a one-time code.' },
  { icon: Search, title: 'Find what you need', text: 'Search and filter the shared library, or join a study group.' },
  { icon: Upload, title: 'Share your own', text: 'Upload notes. Once an admin approves them, everyone can use them.' },
]

function useStats() {
  const [stats, setStats] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    api.get('/public/stats').then((r) => { if (!cancelled) setStats(r.data) }).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [])
  return { stats, failed }
}

export default function LandingPage() {
  const { stats, failed } = useStats()
  useEffect(() => { document.title = 'Campus Connect · Notes, chat and study groups' }, [])

  return (
    <div className="landing">
      <a href="#features" className="skip-link">Skip to content</a>
      <header className="landing__nav">
        <Link to="/" className="landing__brand"><span className="landing__mark"><BookOpen size={18} aria-hidden="true" /></span>Campus Connect</Link>
        <nav className="landing__nav-actions" aria-label="Account">
          <Link to="/login" className="landing__signin">Sign in</Link>
          <Link to="/register"><Button size="sm">Create account</Button></Link>
        </nav>
      </header>

      <section className="landing__hero">
        <div className="landing__hero-copy">
          <p className="landing__eyebrow">For Jadavpur University students and faculty</p>
          <h1 className="landing__title font-display">Everything your campus knows, in one place.</h1>
          <p className="landing__lead">Share and find notes and past papers, chat in real time, and study together. Free, moderated, and made for your classes.</p>
          <div className="landing__cta">
            <Link to="/register"><Button size="lg">Create account <ArrowRight size={16} aria-hidden="true" /></Button></Link>
            <Link to="/login"><Button size="lg" variant="secondary">Sign in</Button></Link>
          </div>
        </div>
        <div className="landing__shot">
          <img src="/landing-preview.webp" alt="Campus Connect dashboard showing recent files, announcements and quick actions" width="800" height="503" fetchpriority="high" />
        </div>
      </section>

      <section className="landing__stats" aria-label="Campus Connect in numbers">
        {[['users', 'Members'], ['files', 'Approved files'], ['groups', 'Public groups']].map(([k, label]) => (
          <div key={k} className="landing__stat">
            <div className="landing__stat-num">{stats ? stats[k] : failed ? '–' : <Skeleton width={56} height={32} />}</div>
            <div className="landing__stat-label">{label}</div>
          </div>
        ))}
      </section>

      <section id="features" className="landing__section">
        <h2 className="landing__h2 font-display">What you get</h2>
        <div className="landing__grid">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <article key={title} className="landing__card">
              <span className="landing__icon"><Icon size={20} aria-hidden="true" /></span>
              <h3>{title}</h3><p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing__section">
        <h2 className="landing__h2 font-display">How it works</h2>
        <ol className="landing__steps">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="landing__step">
              <span className="landing__step-num" aria-hidden="true">{i + 1}</span>
              <div><h3><Icon size={16} aria-hidden="true" className="icon-inline icon-inline--gap" />{title}</h3><p>{text}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing__band">
        <h2 className="font-display">Ready to join?</h2>
        <p>Create your account and start exploring in a minute.</p>
        <Link to="/register"><Button size="lg" variant="secondary">Create account</Button></Link>
      </section>

      <footer className="landing__footer">
        <span>© {new Date().getFullYear()} Campus Connect</span>
        <a href="https://github.com/chitrak-cs/Campus-Connect" target="_blank" rel="noopener noreferrer"><Github size={15} aria-hidden="true" /> GitHub</a>
      </footer>
    </div>
  )
}
