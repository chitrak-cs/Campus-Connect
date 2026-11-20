import { format, isToday, isYesterday, differenceInMinutes, isSameDay } from 'date-fns'
import { Trash2 } from 'lucide-react'
import { linkify } from '../../utils/linkify'
import { Avatar, Badge } from '../ui'

const dayLabel = (d) => (isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'EEEE, d MMMM yyyy'))

export default function MessageList({ messages, meId, isAdmin, onDelete }) {
  return messages.map((m, i) => {
    const date = new Date(m.created_at)
    const prev = messages[i - 1]
    const prevDate = prev && new Date(prev.created_at)
    const newDay = !prev || !isSameDay(date, prevDate)
    // Same sender within 5 minutes on the same day => visually grouped
    const grouped = !newDay && prev.sender_id === m.sender_id && differenceInMinutes(date, prevDate) < 5
    const own = m.sender_id === meId
    const deleted = !!m.deleted_at

    return (
      <div key={m.id}>
        {newDay && <div className="msg-day"><span>{dayLabel(date)}</span></div>}
        <div className={`msg ${own ? 'msg--own' : ''} ${grouped ? 'msg--grouped' : ''}`}>
          {!own && (grouped ? <span className="msg__avatar-gap" /> : <Avatar name={m.sender_name} src={m.sender_avatar} size="sm" />)}
          <div className="msg__col">
            {!grouped && !own && (
              <div className="msg__author">
                {m.sender_name}
                {m.sender_role !== 'student' && <Badge tone={m.sender_role === 'admin' ? 'danger' : 'accent'}>{m.sender_role}</Badge>}
              </div>
            )}
            <div className="msg__row">
              <div className={`msg__bubble ${deleted ? 'is-deleted' : ''}`}>
                {deleted ? 'Message deleted' : linkify(m.content)}
              </div>
              {!deleted && (own || isAdmin) && (
                <button type="button" className="msg__del" onClick={() => onDelete(m)} aria-label="Delete message"><Trash2 size={14} /></button>
              )}
            </div>
            <time className="msg__time" dateTime={date.toISOString()}>{format(date, 'p')}</time>
          </div>
        </div>
      </div>
    )
  })
}
