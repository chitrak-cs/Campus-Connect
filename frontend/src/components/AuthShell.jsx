import { Link } from 'react-router-dom'
import { BookOpen, FileText, MessageSquare, Users } from 'lucide-react'
import '../styles/pages/auth.css'

const POINTS = [
  { icon: FileText, text: 'Notes, past papers and assignments, shared and approved by your campus.' },
  { icon: MessageSquare, text: 'Real-time chat with students and faculty.' },
  { icon: Users, text: 'Study groups, public or invite-only.' },
]

/** Split-screen layout shared by Login / Register / Forgot password. */
export default function AuthShell({ headline, children }) {
  return (
    <div className="auth">
      <aside className="auth__hero">
        <Link to="/" className="auth__brand" aria-label="Campus Connect home">
          <span className="auth__mark"><BookOpen size={20} aria-hidden="true" /></span>
          <span><strong>Campus Connect</strong><small>Jadavpur University</small></span>
        </Link>
        <div className="auth__hero-body">
          <h1 className="auth__headline font-display">{headline}</h1>
          <ul className="auth__points">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text}><Icon size={18} aria-hidden="true" /><span>{text}</span></li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="auth__panel">
        <div className="auth__card">{children}</div>
      </main>
    </div>
  )
}
