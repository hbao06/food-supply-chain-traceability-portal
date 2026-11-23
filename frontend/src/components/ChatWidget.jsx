import { useEffect, useRef, useState } from 'react'
import { IconSparkles } from './Icons.jsx'

const baseUrl = (import.meta.env?.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
const WELCOME = {
  from: 'bot',
  text: 'Xin chào! Mình là trợ lý AI của Food Trace. Hãy hỏi về cách quét QR, quy trình chuỗi cung ứng hoặc nhập mã lô (VD: FR-2026-0001) để mình tra cứu giúp bạn.',
}
const QUICK = ['Cách quét mã QR?', 'Quy trình 6 giai đoạn?', 'Mã lô FR- có định dạng thế nào?', 'Cách tạo lô mới?']

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
    <>
      {open && (
        <section className="chat-window-drawer" role="dialog" aria-label="Trợ lý AI Food Trace">
          <header className="chat-window-head">
            <div className="chat-agent-info">
              <span className="chat-agent-avatar"><IconSparkles /></span>
              <div className="chat-agent-title">
                <strong>Trợ lý Food Trace</strong>
                <small>Hỏi đáp về truy xuất nguồn gốc</small>
              </div>
            </div>
            <button type="button" className="chat-close-btn" onClick={() => setOpen(false)} aria-label="Đóng">✕</button>
          </header>
          <div className="chat-window-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg-row ${m.from}`}>
                <div className="chat-bubble">{m.text}</div>
              </div>
            ))}
            {busy && (
              <div className="chat-msg-row bot">
                <div className="chat-bubble">Đang soạn câu trả lời…</div>
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div className="chat-quick-suggestions">
            {QUICK.map((q) => (
              <button key={q} type="button" className="chat-suggestion-chip" onClick={() => send(q)} disabled={busy}>{q}</button>
            ))}
          </div>
          <form className="chat-input-bar" onSubmit={(e) => { e.preventDefault(); send() }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nhập câu hỏi hoặc mã FR-..."
              maxLength={500}
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Gửi">→</button>
          </form>
        </section>
      )}
      <div className="chat-widget-fab">
        <button
          type="button"
          className="chat-fab-button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Đóng trợ lý AI' : 'Mở trợ lý AI'}
          title="Trợ lý AI Food Trace"
        >
          <IconSparkles />
        </button>
      </div>
    </>
  )
}
