import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../utils/api'
import { getSocket } from '../utils/socket'
import { getActiveChatRoom } from '../utils/chatState'

/**
 * Notifications from announcements + chat (suppressed for your own messages and the open room).
 * Also tracks an unread-chat counter for the sidebar badge.
 */
export default function useNotifications(userId, pathname) {
  const [items, setItems] = useState([])
  const [chatUnread, setChatUnread] = useState(0)
  const pathRef = useRef(pathname)
  pathRef.current = pathname
  const meRef = useRef(userId)
  meRef.current = userId

  const push = useCallback((n) => setItems((prev) => [n, ...prev].slice(0, 50)), [])

  useEffect(() => {
    let mounted = true
    api.get('/announcements').then((res) => {
      if (!mounted) return
      const ann = (res.data.announcements || []).slice(0, 8).map((a) => ({
        id: `ann-${a.id}`, type: 'announcement', title: a.title, body: a.content,
        url: '/', ts: new Date(a.created_at).toISOString(), read: false,
      }))
      setItems((prev) => [...ann, ...prev].slice(0, 50))
    }).catch(() => {})

    const socket = getSocket()
    if (!socket) return () => { mounted = false }

    const roomOpen = (room) => pathRef.current === '/chat' && getActiveChatRoom() === room
    const onGlobal = (msg) => {
      if (msg.sender_id === meRef.current || roomOpen('global')) return
      setChatUnread((c) => c + 1)
      push({ id: `gmsg-${msg.id}`, type: 'message', title: `New message from ${msg.sender_name}`, body: msg.content.slice(0, 120), url: '/chat', ts: new Date(msg.created_at).toISOString(), read: false })
    }
    const onGroup = (msg) => {
      if (msg.sender_id === meRef.current || roomOpen(msg.group_id)) return
      setChatUnread((c) => c + 1)
      push({ id: `g-${msg.id}`, type: 'group_message', title: `New message in ${msg.group_name || 'a group'}`, body: msg.content.slice(0, 120), url: '/chat', state: { groupId: msg.group_id }, ts: new Date(msg.created_at).toISOString(), read: false })
    }
    socket.on('new_global_message', onGlobal)
    socket.on('new_group_message', onGroup)
    return () => { mounted = false; socket.off('new_global_message', onGlobal); socket.off('new_group_message', onGroup) }
  }, [push])

  // Visiting Chat clears its badge
  useEffect(() => { if (pathname === '/chat') setChatUnread(0) }, [pathname])

  const markAllRead = useCallback(() => setItems((prev) => prev.map((n) => ({ ...n, read: true }))), [])
  const unread = items.filter((n) => !n.read).length
  return { items, unread, chatUnread, markAllRead }
}
