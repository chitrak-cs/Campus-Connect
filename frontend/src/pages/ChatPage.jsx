import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { Hash, ArrowLeft, MessageSquare, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { getSocket } from '../utils/socket'
import { setActiveChatRoom } from '../utils/chatState'
import api from '../utils/api'
import MessageList from '../components/chat/MessageList'
import Composer from '../components/chat/Composer'
import { PageHeader, Avatar, EmptyState, Skeleton, ConfirmDialog, Button } from '../components/ui'
import '../styles/pages/chat.css'

const PAGE = 30
const roomUrl = (room) => (room === 'global' ? '/messages/global' : `/messages/group/${room}`)

export default function ChatPage() {
  const { user } = useAuth()
  const location = useLocation()
  const socket = getSocket()

  const [activeRoom, setActiveRoom] = useState(() => location.state?.groupId || 'global')
  const [pane, setPane] = useState(() => (location.state?.groupId ? 'chat' : 'list'))
  const [groups, setGroups] = useState([])
  const [messages, setMessages] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(!!socket?.connected)
  const [online, setOnline] = useState([])
  const [typing, setTyping] = useState(null)
  const [meta, setMeta] = useState({})           // roomId -> { unread, last }
  const [deleting, setDeleting] = useState(null)

  const scroller = useRef(null)
  const bottomRef = useRef(null)
  const stickToBottom = useRef(true)
  const typingTimer = useRef(null)
  const lastTypingEmit = useRef(0)
  const activeRoomRef = useRef(activeRoom)
  const prependAnchor = useRef(null) // { height, top } captured just before older messages are prepended

  const scrollToBottom = useCallback((smooth = false) => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' }))
  }, [])

  // Keep the active room in a ref (listeners read it) and tell Layout which room is open
  useEffect(() => {
    activeRoomRef.current = activeRoom
    setActiveChatRoom(activeRoom)
    setTyping(null)
    setMeta((m) => ({ ...m, [activeRoom]: { ...m[activeRoom], unread: 0 } }))
  }, [activeRoom])
  useEffect(() => () => setActiveChatRoom(null), [])

  useEffect(() => { api.get('/groups').then((r) => setGroups((r.data.groups || []).filter((g) => g.is_member))).catch(() => {}) }, [])

  // History for the active room
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    stickToBottom.current = true
    api.get(roomUrl(activeRoom), { params: { limit: PAGE } }).then((res) => {
      if (cancelled) return
      setMessages(res.data.messages || [])
      setHasMore(!!res.data.hasMore)
      const last = res.data.messages?.at(-1)
      if (last) setMeta((m) => ({ ...m, [activeRoom]: { ...m[activeRoom], last } }))
    }).catch((err) => { if (!cancelled) toast.error(err.response?.data?.message || 'Failed to load messages') })
      .finally(() => { if (!cancelled) { setLoading(false); scrollToBottom() } })
    return () => { cancelled = true }
  }, [activeRoom, scrollToBottom])

  const loadOlder = async () => {
    if (!messages.length || loadingOlder) return
    const el = scroller.current
    setLoadingOlder(true)
    try {
      const res = await api.get(roomUrl(activeRoom), { params: { limit: PAGE, before: messages[0].created_at } })
      prependAnchor.current = { height: el.scrollHeight, top: el.scrollTop }
      setMessages((prev) => [...(res.data.messages || []), ...prev])
      setHasMore(!!res.data.hasMore)
    } catch { toast.error('Could not load older messages') } finally { setLoadingOlder(false) }
  }

  // After older messages render, restore the viewport so the reader doesn't jump
  useLayoutEffect(() => {
    const a = prependAnchor.current
    const el = scroller.current
    if (!a || !el) return
    el.scrollTop = a.top + (el.scrollHeight - a.height)
    prependAnchor.current = null
  }, [messages])

  // Connection + presence
  useEffect(() => {
    if (!socket) return
    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    const onOnline = (u) => setOnline(u)
    setConnected(socket.connected)
    socket.emit('get_online_users')
    socket.on('connect', onConnect); socket.on('disconnect', onDisconnect); socket.on('online_users', onOnline)
    return () => { socket.off('connect', onConnect); socket.off('disconnect', onDisconnect); socket.off('online_users', onOnline) }
  }, [socket])

  // Messages, deletions and typing (named handlers; room read from a ref)
  useEffect(() => {
    if (!socket) return
    const receive = (room, msg) => {
      setMeta((m) => ({ ...m, [room]: { unread: room === activeRoomRef.current ? 0 : (m[room]?.unread || 0) + (msg.sender_id === user?.id ? 0 : 1), last: msg } }))
      if (room !== activeRoomRef.current) return
      const el = scroller.current
      stickToBottom.current = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120 || msg.sender_id === user?.id
      setMessages((prev) => (prev.some((p) => p.id === msg.id) ? prev : [...prev, msg]))
      if (stickToBottom.current) scrollToBottom(true)
    }
    const onGlobal = (msg) => receive('global', msg)
    const onGroup = (msg) => receive(msg.group_id, msg)
    const onDeleted = ({ id }) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, deleted_at: new Date().toISOString(), content: '' } : m)))
      setMeta((m) => Object.fromEntries(Object.entries(m).map(([room, v]) => [room, v?.last?.id === id ? { ...v, last: { ...v.last, deleted_at: 'now', content: '' } } : v])))
    }
    const onTyping = ({ name, room }) => {
      if (room !== activeRoomRef.current) return
      setTyping(name)
      clearTimeout(typingTimer.current)
      typingTimer.current = setTimeout(() => setTyping(null), 2500)
    }
    const onLimited = () => toast.error('You are sending messages too fast')
    socket.on('new_global_message', onGlobal); socket.on('new_group_message', onGroup)
    socket.on('message_deleted', onDeleted); socket.on('user_typing', onTyping); socket.on('rate_limited', onLimited)
    return () => {
      socket.off('new_global_message', onGlobal); socket.off('new_group_message', onGroup)
      socket.off('message_deleted', onDeleted); socket.off('user_typing', onTyping); socket.off('rate_limited', onLimited)
      clearTimeout(typingTimer.current)
    }
  }, [socket, user?.id, scrollToBottom])

  const send = () => {
    const content = input.trim()
    if (!content || !socket?.connected) return
    if (activeRoom === 'global') socket.emit('send_global_message', { content })
    else socket.emit('send_group_message', { content, group_id: activeRoom })
    setInput('')
  }

  const emitTyping = () => {
    const now = Date.now()
    if (now - lastTypingEmit.current < 2000) return
    lastTypingEmit.current = now
    if (activeRoom === 'global') socket?.emit('typing_global')
    else socket?.emit('typing_group', { group_id: activeRoom })
  }

  const confirmDelete = async () => {
    try { await api.delete(`/messages/${deleting.id}`) } catch (err) { toast.error(err.response?.data?.message || 'Could not delete message') }
    setDeleting(null)
  }

  const openRoom = (room) => { setActiveRoom(room); setPane('chat') }
  const activeGroup = groups.find((g) => g.id === activeRoom)
  const roomName = activeRoom === 'global' ? 'Campus Global' : activeGroup?.name || 'Group'

  const RoomButton = ({ room, name, icon }) => {
    const m = meta[room]
    return (
      <button type="button" className={`room ${activeRoom === room ? 'is-active' : ''}`} aria-current={activeRoom === room ? 'true' : undefined} onClick={() => openRoom(room)}>
        {icon}
        <span className="room__text">
          <span className="room__name">{name}</span>
          {m?.last && <span className="room__last">{m.last.deleted_at ? 'Message deleted' : `${m.last.sender_id === user?.id ? 'You' : m.last.sender_name?.split(' ')[0]}: ${m.last.content}`}</span>}
        </span>
        {m?.unread > 0 && <span className="room__unread" aria-label={`${m.unread} unread`}>{m.unread > 9 ? '9+' : m.unread}</span>}
      </button>
    )
  }

  const chip = (
    <span className={`conn ${connected ? 'is-live' : ''}`} role="status"><span className="conn__dot" />{connected ? 'Live' : 'Connecting…'}</span>
  )

  return (
    <div className="chat-page">
      <div className="chat-page__header"><PageHeader title="Chat" subtitle="Talk with students and faculty in real time" actions={chip} /></div>

      <div className={`chat chat--${pane}`}>
        <aside className="chat__rooms" aria-label="Conversations">
          <div className="rooms__group">
            <div className="rooms__label">Channels</div>
            <RoomButton room="global" name="Campus Global" icon={<span className="room__icon"><Hash size={16} /></span>} />
          </div>
          <div className="rooms__group">
            <div className="rooms__label">My groups</div>
            {groups.length === 0 && <p className="rooms__empty">Join a group to chat with your classmates.</p>}
            {groups.map((g) => (
              <RoomButton key={g.id} room={g.id} name={g.name}
                icon={<span className="room__icon" style={{ background: g.avatar_color, color: '#fff' }}>{g.is_private ? <Lock size={13} /> : g.name[0].toUpperCase()}</span>} />
            ))}
          </div>
          <div className="rooms__group rooms__online">
            <div className="rooms__label">Online ({online.length})</div>
            {online.slice(0, 20).map((u) => (
              <div key={u.id} className="online"><span className="online__av"><Avatar name={u.name} src={u.avatar_url} size="xs" /><i /></span><span className="truncate">{u.name}</span></div>
            ))}
          </div>
        </aside>

        <section className="chat__main" aria-label={`Conversation: ${roomName}`}>
          <header className="chat__head">
            <button type="button" className="chat__back" onClick={() => setPane('list')} aria-label="Back to conversations"><ArrowLeft size={18} /></button>
            <div className="chat__title">
              {activeRoom === 'global' ? <Hash size={18} aria-hidden="true" /> : <span className="room__icon" style={{ background: activeGroup?.avatar_color, color: '#fff' }}>{roomName[0]}</span>}
              <div>
                <h2>{roomName}</h2>
                <p>{activeRoom === 'global' ? 'All students and faculty' : `${activeGroup?.member_count ?? ''} members`}</p>
              </div>
            </div>
            <div className="chat__chip-mobile">{chip}</div>
          </header>

          <div className="chat__scroll" ref={scroller} onScroll={(e) => { const el = e.currentTarget; stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120 }}>
            {hasMore && (
              <div className="chat__older"><Button size="sm" variant="secondary" loading={loadingOlder} onClick={loadOlder}>Load older messages</Button></div>
            )}
            {loading ? (
              <div className="chat__skeleton">{[70, 45, 80, 55].map((w, i) => <Skeleton key={i} width={`${w}%`} height={42} radius="var(--r-lg)" />)}</div>
            ) : messages.length === 0 ? (
              <EmptyState icon={MessageSquare} title="No messages yet" text="Say hello and start the conversation." />
            ) : (
              <MessageList messages={messages} meId={user?.id} isAdmin={user?.role === 'admin'} onDelete={setDeleting} />
            )}
            <div className="chat__typing" aria-live="polite">{typing ? `${typing.split(' ')[0]} is typing…` : ''}</div>
            <div ref={bottomRef} />
          </div>

          <Composer value={input} onChange={setInput} onSend={send} onTyping={emitTyping} disabled={!connected}
            placeholder={`Message ${activeRoom === 'global' ? 'Campus Global' : roomName}`} />
        </section>
      </div>

      <ConfirmDialog open={!!deleting} danger title="Delete this message?" confirmLabel="Delete"
        message="It will be replaced with “Message deleted” for everyone in this conversation."
        onCancel={() => setDeleting(null)} onConfirm={confirmDelete} />
    </div>
  )
}
