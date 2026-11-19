import { useEffect, useRef, useState } from 'react'
import { IconSparkles } from './Icons.jsx'

const baseUrl = (import.meta.env?.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
const WELCOME = {
  from: 'bot',
  text: 'Xin chào! Mình là trợ lý AI của Food Trace. Hãy hỏi về cách quét QR, quy trình chuỗi cung ứng hoặc nhập mã lô (VD: FR-2026-0201) để mình tra cứu giúp bạn.',
}
const QUICK = ['Cách quét mã QR?', 'Quy trình 6 giai đoạn?', 'Tra cứu lô FR-2026-0201', 'Cách tạo lô mới?']

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([WELCOME])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    const openHandler = () => setOpen(true)
    window.addEventListener('ft-open-chat', openHandler)
    return () => window.removeEventListener('ft-open-chat', openHandler)
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, open, busy])

  async function send(text) {
    const msg = String(text ?? input).trim()
    if (!msg || busy) return
    setInput('')
    setMessages((m) => [...m, { from: 'user', text: msg }])
    setBusy(true)
    try {
      const res = await fetch(`${baseUrl}/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || 'error')
      setMessages((m) => [...m, { from: 'bot', text: data.reply }])
    } catch {
      setMessages((m) => [...m, { from: 'bot', text: 'Hiện chưa kết nối được máy chủ. Vui lòng bật backend rồi thử lại.' }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="chat-widget">
      {open && (
        <section className="chat-panel" role="dialog" aria-label="Trợ lý AI Food Trace">
          <header className="chat-head">
            <span className="chat-bot-avatar"><IconSparkles /></span>
            <div>
              <strong>Trợ lý Food Trace</strong>
              <small>Hỏi đáp về truy xuất nguồn gốc</small>
            </div>
            <button type="button" className="chat-close" onClick={() => setOpen(false)} aria-label="Đóng">✕</button>
          </header>
          <div className="chat-body">
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.from}`}>{m.text}</div>
            ))}
            {busy && <div className="chat-msg bot typing">Đang soạn câu trả lời…</div>}
            <div ref={endRef} />
          </div>
          <div className="chat-quick">
            {QUICK.map((q) => (
              <button key={q} type="button" onClick={() => send(q)} disabled={busy}>{q}</button>
            ))}
          </div>
          <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send() }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Nhập câu hỏi hoặc mã FR-..." maxLength={500} />
            <button type="submit" className="btn-olive-pill sm" disabled={busy || !input.trim()}>Gửi</button>
          </form>
        </section>
      )}
      <button type="button" className="chat-fab" onClick={() => setOpen((o) => !o)} aria-label="Mở trợ lý AI">
        <IconSparkles /> <span>Trợ lý AI</span>
      </button>
    </div>
  )
}
