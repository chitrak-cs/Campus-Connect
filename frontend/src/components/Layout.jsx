import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import {
  LayoutDashboard, FileText, MessageSquare, Users, ShieldCheck, User, LogOut, Menu, X,
  BookOpen, Bell, Search, Sun, Moon, Megaphone, MessageCircle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import useNotifications from '../hooks/useNotifications'
import { Avatar, DropdownMenu, RoleBadge } from './ui'
import '../styles/layout.css'

const TITLES = { '/': 'Dashboard', '/files': 'Files', '/chat': 'Chat', '/groups': 'Groups', '/profile': 'Profile', '/admin': 'Admin' }
const NAV = [
  { group: 'Learn', items: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/', end: true },
    { label: 'Files', icon: FileText, path: '/files' },
  ] },
  { group: 'Connect', items: [
    { label: 'Chat', icon: MessageSquare, path: '/chat', badge: 'chat' },
    { label: 'Groups', icon: Users, path: '/groups' },
  ] },
]
const TABS = [
  { label: 'Home', icon: LayoutDashboard, path: '/', end: true },
  { label: 'Files', icon: FileText, path: '/files' },
  { label: 'Chat', icon: MessageSquare, path: '/chat', badge: 'chat' },
  { label: 'Groups', icon: Users, path: '/groups' },
  { label: 'Profile', icon: User, path: '/profile' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawer, setDrawer] = useState(false)
  const { items, unread, chatUnread, markAllRead } = useNotifications(user?.id, location.pathname)

  const title = TITLES[location.pathname] || 'Campus Connect'
  const groups = user?.role === 'admin'
    ? [...NAV, { group: 'Admin', items: [{ label: 'Admin panel', icon: ShieldCheck, path: '/admin' }] }]
    : NAV

  // Route change: close drawer, scroll to top, set the document title
  useEffect(() => {
    setDrawer(false)
    window.scrollTo(0, 0)
    document.title = location.pathname === '/' ? 'Campus Connect' : `${title} · Campus Connect`
  }, [location.pathname, title])

  const badge = (key) => (key === 'chat' && chatUnread > 0
    ? <span className="shell-badge" aria-label={`${chatUnread} unread`}>{chatUnread > 9 ? '9+' : chatUnread}</span> : null)

  const NavItem = ({ item }) => (
    <NavLink to={item.path} end={item.end} className={({ isActive }) => `shell-nav__item ${isActive ? 'is-active' : ''}`}>
      <item.icon size={18} aria-hidden="true" />
      <span>{item.label}</span>
      {badge(item.badge)}
    </NavLink>
  )

  const goTo = (n) => navigate(n.url, n.state ? { state: n.state } : undefined)
  const announcements = items.filter((n) => n.type === 'announcement')
  const messages = items.filter((n) => n.type !== 'announcement')

  const NotifRow = ({ n, close }) => (
    <button type="button" className={`notif-row ${n.read ? '' : 'is-unread'}`} onClick={() => { close(); goTo(n) }}>
      <span className={`notif-row__icon notif-row__icon--${n.type === 'announcement' ? 'ann' : 'msg'}`}>
        {n.type === 'announcement' ? <Megaphone size={16} aria-hidden="true" /> : <MessageCircle size={16} aria-hidden="true" />}
      </span>
      <span className="notif-row__text">
        <strong>{n.title}</strong>
        <span className="notif-row__body">{n.body}</span>
        <time className="notif-row__time">{formatDistanceToNow(new Date(n.ts), { addSuffix: true })}</time>
      </span>
    </button>
  )

  return (
    <div className="shell">
      <a href="#main" className="skip-link">Skip to content</a>
      {drawer && <div className="shell-scrim" onClick={() => setDrawer(false)} aria-hidden="true" />}

      <aside className={`shell-sidebar ${drawer ? 'is-open' : ''}`} aria-label="Primary">
        <div className="shell-brand">
          <span className="shell-brand__mark"><BookOpen size={18} aria-hidden="true" /></span>
          <span>
            <span className="shell-brand__name">Campus Connect</span>
            <span className="shell-brand__sub">Jadavpur University</span>
          </span>
        </div>
        <nav className="shell-nav">
          {groups.map((g) => (
            <div key={g.group} className="shell-nav__group">
              <div className="shell-nav__label">{g.group}</div>
              {g.items.map((item) => <NavItem key={item.path} item={item} />)}
            </div>
          ))}
        </nav>
        <div className="shell-user">
          <button type="button" className="shell-user__card" onClick={() => navigate('/profile')}>
            <Avatar name={user?.name} src={user?.avatar_url} size="md" />
            <span className="shell-user__text">
              <span className="shell-user__name">{user?.name}</span>
              <span className="shell-user__role">{user?.role}{user?.department ? ` · ${user.department}` : ''}</span>
            </span>
          </button>
        </div>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <button type="button" className="topbar__btn topbar__menu" onClick={() => setDrawer((v) => !v)} aria-label={drawer ? 'Close menu' : 'Open menu'} aria-expanded={drawer}>
            {drawer ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h2 className="topbar__title">{title}</h2>

          <button type="button" className="topbar__search" onClick={() => navigate('/files')} aria-label="Search files">
            <Search size={15} aria-hidden="true" />
            <span>Search files and groups</span>
            <kbd>Ctrl K</kbd>
          </button>

          <div className="topbar__actions">
            <button type="button" className="topbar__btn" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <DropdownMenu label="Notifications" align="right"
              trigger={({ props }) => (
                <button type="button" className="topbar__btn topbar__bell" {...props}
                  aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
                  <Bell size={18} />{unread > 0 && <span className="topbar__dot" aria-hidden="true" />}
                </button>
              )}
              panel={({ close }) => (
                <div className="notif">
                  <div className="notif__head">
                    <strong>Notifications</strong>
                    <button type="button" className="notif__markall" onClick={markAllRead} disabled={!unread}>Mark all read</button>
                  </div>
                  <div className="notif__list">
                    {items.length === 0 && <p className="notif__empty">You're all caught up.</p>}
                    {messages.length > 0 && <div className="notif__group">Messages</div>}
                    {messages.map((n) => <NotifRow key={n.id} n={n} close={close} />)}
                    {announcements.length > 0 && <div className="notif__group">Announcements</div>}
                    {announcements.map((n) => <NotifRow key={n.id} n={n} close={close} />)}
                  </div>
                </div>
              )}
            />

            <DropdownMenu label="Account menu" align="right"
              trigger={({ props }) => (
                <button type="button" className="topbar__avatar" {...props}>
                  <Avatar name={user?.name} src={user?.avatar_url} size="sm" />
                </button>
              )}
              items={[
                { label: 'Profile', icon: User, onClick: () => navigate('/profile') },
                { label: 'Log out', icon: LogOut, danger: true, onClick: () => { logout(); navigate('/login') } },
              ]}
            />
          </div>
        </header>
        <main id="main" className="shell-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <nav className="tabbar" aria-label="Quick navigation">
        {TABS.map((t) => (
          <NavLink key={t.path} to={t.path} end={t.end} className={({ isActive }) => `tabbar__item ${isActive ? 'is-active' : ''}`}>
            <span className="tabbar__icon"><t.icon size={20} aria-hidden="true" />{badge(t.badge)}</span>
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
