// Turn http(s) URLs in plain text into links without ever injecting HTML.
const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)"'\]])/g

export function linkify(text) {
  if (!text) return null
  return text.split(URL_RE).map((part, i) =>
    i % 2 === 1
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
      : part
  )
}
