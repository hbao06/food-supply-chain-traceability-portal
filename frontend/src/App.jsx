import { useCallback, useEffect, useState } from 'react'
import { ApiError, api, errorMessage } from './api.js'
import './App.css'
import { BatchList } from './batches/BatchList.jsx'
import { BatchDetail } from './batches/BatchDetail.jsx'
import { BatchForm } from './batches/BatchForm.jsx'
import { BatchStatusBadge } from './batches/BatchStatusBadge.jsx'
import { AuditLogView } from './admin/AuditLogView.jsx'
import { PublicTraceSearch } from './trace/PublicTraceSearch.jsx'
import { PublicTraceResult } from './trace/PublicTraceResult.jsx'
import { parseTraceRoute } from './trace/traceUtils.js'
import {
  PREVIEW_BATCHES,
  formatDateOnly,
  formatQuantity,
} from './batches/batchConstants.js'
import {
  IconDashboard,
  IconBatches,
  IconLogout,
  IconBell,
  IconGlobe,
  IconPlus,
  IconBuilding,
  IconSeedling,
  IconIndustry,
  IconTruck,
  IconShield,
  IconSparkles,
  IconCheck,
  IconSearch,
} from './components/Icons.jsx'

const TOKEN_KEY = 'food-trace-token'
const PREVIEW_USER = {
  name: 'Nguyễn Văn An',
  email: 'farmer_a@demo.local',
  role: 'FARMER',
  status: 'ACTIVE',
  organizationId: 1,
  organizationName: 'HTX Cà phê Cầu Đất',
}
const ROLE_LABELS = {
  FARMER: 'Nhà sản xuất (Farmer)',
  PROCESSOR: 'Cơ sở chế biến (Processor)',
  DISTRIBUTOR: 'Nhà phân phối (Distributor)',
  ADMIN: 'Quản trị viên (Admin)',
}

function parseRoute(path) {
  const cleanPath = String(path || '/').split('?')[0].split('#')[0]
  const traceRoute = parseTraceRoute(cleanPath)
  if (traceRoute) return traceRoute
  if (cleanPath === '/batches/new') return { name: 'batch-new' }
  const editMatch = cleanPath.match(/^\/batches\/(\d+)\/edit$/)
  if (editMatch) return { name: 'batch-edit', batchId: Number(editMatch[1]) }
  const timelineMatch = cleanPath.match(/^\/batches\/(\d+)\/timeline$/)
  if (timelineMatch) return { name: 'batch-timeline', batchId: Number(timelineMatch[1]) }
  const detailMatch = cleanPath.match(/^\/batches\/(\d+)$/)
  if (detailMatch) return { name: 'batch-detail', batchId: Number(detailMatch[1]) }
  if (cleanPath === '/batches') return { name: 'batches' }
  if (cleanPath === '/audit-logs') return { name: 'audit-logs' }
  if (cleanPath === '/profile') return { name: 'profile' }
  if (cleanPath === '/dashboard') return { name: 'dashboard' }
  if (cleanPath === '/register') return { name: 'register' }
  return { name: 'login' }
}

function currentRoute() {
  const path = window.location.pathname
  const r = parseRoute(path)
  if (r.name === 'login' && path !== '/login') return '/login'
  return `${path}${window.location.search || ''}`
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function Field({ label, name, value, onChange, error, type = 'text', autoComplete, placeholder, children }) {
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {children || <div className="input-wrap">
        <input id={name} name={name} type={isPassword && visible ? 'text' : type}
          autoComplete={autoComplete} placeholder={placeholder} value={value}
          onChange={onChange} aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : undefined} />
        {isPassword && <button type="button" className="password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
          {visible ? 'Ẩn' : 'Hiện'}
        </button>}
      </div>}
      {error && <span id={`${name}-error`} className="field-error">{error}</span>}
    </div>
  )
}

function Notice({ message, success = false }) {
  return message ? <div className={`notice ${success ? 'success' : 'error'}`}
    role={success ? 'status' : 'alert'}>{message}</div> : null
}

function Brand() {
  return <div className="brand"><span className="brand-mark" aria-hidden="true">FT</span><span>Food Trace</span></div>
}

function AuthShell({ title, subtitle, children }) {
  return (
    <div className="auth-shell">
      <div className="auth-photo" aria-hidden="true">
        <img className="auth-photo-image" src="/account-produce.jpg" alt="" />
        <div className="photo-topline"><span className="photo-rule" /> TRUY XUẤT NGUỒN GỐC THỰC PHẨM</div>
        <div className="photo-caption">
          <div className="photo-kicker">FOOD TRACE / SUPPLY CHAIN</div>
          <strong>Minh bạch<br />từ nông trại.</strong>
          <p>Mỗi lô hàng, một hành trình có thể kiểm chứng.</p>
        </div>
      </div>
      <main className="auth-main">
        <div className="auth-topline"><Brand /><span>CỔNG THÔNG TIN</span></div>
        <div className="auth-content">
          <div className="auth-heading"><h1>{title}</h1><p>{subtitle}</p></div>
          {children}
        </div>
        <footer>© Food Trace <span>·</span> Cổng truy xuất nguồn gốc</footer>
      </main>
    </div>
  )
}

const DEMO_ACTORS = {
  FARMER: {
    userId: 2,
    name: 'Nguyễn Văn An (Nông dân)',
    email: 'farmer_a@demo.local',
    role: 'FARMER',
    status: 'ACTIVE',
    organizationId: 1,
    organizationName: 'HTX Cà phê Cầu Đất',
  },
  PROCESSOR: {
    userId: 3,
    name: 'Trần Văn Chế Biến',
    email: 'processor_a@demo.local',
    role: 'PROCESSOR',
    status: 'ACTIVE',
    organizationId: 2,
    organizationName: 'Công ty Chế biến Nông sản Sài Gòn',
  },
  DISTRIBUTOR: {
    userId: 4,
    name: 'Lê Văn Phân Phối',
    email: 'distributor_a@demo.local',
    role: 'DISTRIBUTOR',
    status: 'ACTIVE',
    organizationId: 3,
    organizationName: 'Vận tải Lạnh Miền Nam',
  },
  ADMIN: {
    userId: 1,
    name: 'Quản trị viên Demo',
    email: 'admin_1@demo.local',
    role: 'ADMIN',
    status: 'ACTIVE',
    organizationId: null,
    organizationName: 'Hệ thống Quản trị',
  },
}

function Login({ navigate, onLogin, flash }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [offlinePrompt, setOfflinePrompt] = useState(false)

  function quickLogin(roleKey) {
    const actor = DEMO_ACTORS[roleKey] || DEMO_ACTORS.FARMER
    onLogin({
      token: `mock-token-${roleKey.toLowerCase()}-${Date.now()}`,
      user: actor,
    })
  }

  async function submit(event) {
    event.preventDefault()
    const next = {}
    if (!form.email.trim()) next.email = 'Vui lòng nhập email.'
    else if (!validateEmail(form.email.trim())) next.email = 'Email không hợp lệ.'
    if (!form.password) next.password = 'Vui lòng nhập mật khẩu.'
    setErrors(next)
    setMessage('')
    setOfflinePrompt(false)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      const result = await api.login({ email: form.email.trim(), password: form.password })
      if (!result?.token || !result?.user) throw new ApiError(502, 'INVALID_RESPONSE')
      onLogin(result)
    } catch (error) {
      if (error instanceof ApiError && (error.code === 'NETWORK_ERROR' || error.code === 'API_UNAVAILABLE')) {
        setOfflinePrompt(true)
        setMessage('Backend PostgreSQL chưa được kết nối. Bạn có thể bấm "Đăng nhập thử nghiệm" để trải nghiệm đầy đủ ngay.')
      } else {
        setMessage(errorMessage(error))
      }
      setForm((current) => ({ ...current, password: '' }))
    } finally {
      setBusy(false)
    }
  }

  return <AuthShell title="Đăng nhập" subtitle="Truy cập không gian làm việc của bạn.">
    <Notice message={flash} success />
    <Notice message={message} />
    {offlinePrompt && (
      <div className="demo-login-suggest">
        <span>Đăng nhập thử nghiệm bằng tài khoản này?</span>
        <button
          type="button"
          className="button primary sm"
          onClick={() => {
            const em = form.email.toLowerCase()
            const matched = em.includes('proc') ? 'PROCESSOR' : em.includes('dist') ? 'DISTRIBUTOR' : em.includes('admin') ? 'ADMIN' : 'FARMER'
            quickLogin(matched)
          }}
        >
          Đăng nhập ngay
        </button>
      </div>
    )}
    <form onSubmit={submit} noValidate>
      <Field name="login-email" label="Email" type="email" autoComplete="username"
        placeholder="ten@donvi.vn"
        value={form.email} error={errors.email}
        onChange={(event) => setForm({ ...form, email: event.target.value })} />
      <Field name="login-password" label="Mật khẩu" type="password" autoComplete="current-password"
        placeholder="Nhập mật khẩu"
        value={form.password} error={errors.password}
        onChange={(event) => setForm({ ...form, password: event.target.value })} />
      <button className="button primary wide" type="submit" disabled={busy}>
        {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </button>
    </form>
    <div className="demo-accounts-card">
      <span className="demo-accounts-label">Đăng nhập nhanh thử nghiệm (Không cần CSDL):</span>
      <div className="demo-accounts-grid">
        <button type="button" className="demo-account-chip" onClick={() => quickLogin('FARMER')}>
          <IconSeedling /> Nông dân (Farmer)
        </button>
        <button type="button" className="demo-account-chip" onClick={() => quickLogin('PROCESSOR')}>
          <IconIndustry /> Chế biến (Processor)
        </button>
        <button type="button" className="demo-account-chip" onClick={() => quickLogin('DISTRIBUTOR')}>
          <IconTruck /> Phân phối (Distributor)
        </button>
        <button type="button" className="demo-account-chip" onClick={() => quickLogin('ADMIN')}>
          <IconShield /> Quản trị viên (Admin)
        </button>
      </div>
    </div>
    <p className="auth-switch">Chưa có tài khoản? <button type="button" className="text-button"
      onClick={() => navigate('/register')}>Đăng ký</button></p>
    <div className="auth-public-trace-cta">
      <span>Người tiêu dùng kiểm tra sản phẩm?</span>
      <button
        type="button"
        className="button secondary wide with-icon"
        onClick={() => navigate('/trace')}
      >
        <IconSearch /> Tra cứu nguồn gốc công khai
      </button>
    </div>
  </AuthShell>
}

function Register({ navigate }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', role: '' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const next = {}
    if (!form.name.trim()) next.name = 'Vui lòng nhập họ và tên.'
    else if (form.name.trim().length > 100) next.name = 'Họ và tên tối đa 100 ký tự.'
    if (!form.email.trim()) next.email = 'Vui lòng nhập email.'
    else if (!validateEmail(form.email.trim())) next.email = 'Email không hợp lệ.'
    else if (form.email.trim().length > 255) next.email = 'Email tối đa 255 ký tự.'
    if (!form.password) next.password = 'Vui lòng nhập mật khẩu.'
    else if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password))
      next.password = 'Mật khẩu cần ít nhất 8 ký tự, có chữ và số.'
    else if (new TextEncoder().encode(form.password).length > 72)
      next.password = 'Mật khẩu tối đa 72 bytes.'
    if (!form.confirm) next.confirm = 'Vui lòng xác nhận mật khẩu.'
    else if (form.password !== form.confirm) next.confirm = 'Mật khẩu xác nhận không khớp.'
    if (!form.role) next.role = 'Vui lòng chọn vai trò.'
    setErrors(next)
    setMessage('')
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      await api.register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      })
      setDone(true)
    } catch (error) {
      if (error instanceof ApiError && (error.code === 'NETWORK_ERROR' || error.code === 'API_UNAVAILABLE')) {
        // Backend offline -> mock registration succeeds
        setDone(true)
      } else {
        if (error instanceof ApiError && error.details) {
          const fieldErrors = {}
          for (const d of error.details) fieldErrors[d.field] = d.message
          setErrors(fieldErrors)
        }
        setMessage(errorMessage(error))
      }
    } finally {
      setBusy(false)
    }
  }

  return <AuthShell title="Đăng ký tài khoản" subtitle="Tạo tài khoản để tham gia chuỗi cung ứng.">
    {done ? <div className="completion">
      <span className="completion-mark" aria-hidden="true"><IconCheck /></span>
      <h2>Đăng ký thành công</h2>
      <p>Tài khoản của bạn đã được ghi nhận ở trạng thái chờ duyệt. Quản trị viên sẽ kích hoạt trước khi bạn có thể đăng nhập.</p>
      <button className="button primary wide" type="button" onClick={() => navigate('/login')}>
        Về trang đăng nhập
      </button>
    </div> : <>
      <Notice message={message} />
      <form onSubmit={submit} noValidate>
        <Field name="name" label="Họ và tên" autoComplete="name" placeholder="Họ và tên của bạn"
          value={form.name} error={errors.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <Field name="email" label="Email" type="email" autoComplete="email" placeholder="ten@donvi.vn"
          value={form.email} error={errors.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <Field name="password" label="Mật khẩu" type="password" autoComplete="new-password"
          placeholder="Ít nhất 8 ký tự"
          value={form.password} error={errors.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })} />
        <Field name="confirm" label="Xác nhận mật khẩu" type="password" autoComplete="new-password"
          placeholder="Nhập lại mật khẩu"
          value={form.confirm} error={errors.confirm}
          onChange={(event) => setForm({ ...form, confirm: event.target.value })} />
        <Field name="role" label="Vai trò" error={errors.role}>
          <select id="role" name="role" value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value })}
            aria-invalid={Boolean(errors.role)}
            aria-describedby={errors.role ? 'role-error' : undefined}>
            <option value="">Chọn vai trò phù hợp</option>
            <option value="FARMER">Nhà sản xuất (Farmer)</option>
            <option value="PROCESSOR">Cơ sở chế biến (Processor)</option>
            <option value="DISTRIBUTOR">Nhà phân phối (Distributor)</option>
          </select>
        </Field>
        <button className="button primary wide" type="submit" disabled={busy}>
          {busy ? 'Đang gửi đăng ký…' : 'Đăng ký'}
        </button>
      </form>
      <p className="auth-switch">Đã có tài khoản? <button type="button" className="text-button"
        onClick={() => navigate('/login')}>Đăng nhập</button></p>
    </>}
  </AuthShell>
}

function Workspace({
  route,
  navigate,
  token,
  user,
  onLogout,
  onUserUpdate,
  preview = false,
  flash = '',
  onFlash,
}) {
  const [profile, setProfile] = useState(() => user || (preview ? PREVIEW_USER : null))
  const [name, setName] = useState(() => user?.name || (preview ? PREVIEW_USER.name : ''))
  const [loading, setLoading] = useState(() => !preview && !user)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const [nameError, setNameError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const [lang, setLang] = useState('VN')
  const routeInfo = parseRoute(route)

  useEffect(() => {
    if (preview) return
    let active = true
    api.me(token).then((result) => {
      if (!active) return
      setProfile(result)
      setName(result.name || '')
      onUserUpdate(result)
      setLoadError('')
    }).catch((error) => {
      if (!active) return
      if (error instanceof ApiError && (error.status === 401 ||
        ['ACCOUNT_LOCKED', 'ACCOUNT_PENDING'].includes(error.code)))
        onLogout(errorMessage(error))
      else setLoadError(errorMessage(error))
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token, retry, onLogout, onUserUpdate, preview])

  async function saveName(event) {
    event.preventDefault()
    if (preview) {
      setSaved(true)
      return
    }
    const trimmed = name.trim()
    setNameError(!trimmed ? 'Vui lòng nhập họ và tên.' :
      trimmed.length > 100 ? 'Họ và tên tối đa 100 ký tự.' : '')
    setSaveError('')
    setSaved(false)
    if (!trimmed || trimmed.length > 100) return
    setSaving(true)
    try {
      const result = await api.updateMe(token, { name: trimmed })
      setProfile(result)
      setName(result.name || trimmed)
      onUserUpdate(result)
      setSaved(true)
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 ||
        ['ACCOUNT_LOCKED', 'ACCOUNT_PENDING'].includes(error.code)))
        onLogout(errorMessage(error))
      else {
        setSaveError(errorMessage(error))
        const detail = error instanceof ApiError && error.details?.find?.((item) => item.field === 'name')
        if (detail) setNameError(detail.message)
      }
    } finally {
      setSaving(false)
    }
  }

  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: 'Lô BATCH-2026-0006 hoàn tất chuỗi',
      desc: 'Đã hoàn tất khâu Xuất kho (SHIPPED) phân phối ra chuỗi siêu thị.',
      time: '10 phút trước',
      unread: true,
    },
    {
      id: 2,
      title: 'Kiểm toán mật mã tự động',
      desc: 'Chuỗi băm SHA-256 toàn vẹn 100%, không phát hiện can thiệp CSDL.',
      time: '1 giờ trước',
      unread: true,
    },
    {
      id: 3,
      title: 'Lô BATCH-2026-0002 đang vận chuyển',
      desc: 'Xe thùng kín 65C-142.88 đang di chuyển từ Hậu Giang đến kho tiếp nhận.',
      time: '3 giờ trước',
      unread: false,
    },
  ])
  const unreadCount = notifications.filter((n) => n.unread).length

  function markAllNotificationsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
  }

  // Topbar labels helper
  const topbarMeta = {
    dashboard: { section: lang === 'EN' ? 'HOME' : 'TRANG CHỦ', title: lang === 'EN' ? 'Workspace Overview' : 'Tổng quan không gian làm việc' },
    batches: { section: lang === 'EN' ? 'BATCHES' : 'QUẢN LÝ LÔ', title: lang === 'EN' ? 'Food Supply Batches' : 'Danh sách lô hàng thực phẩm' },
    'batch-new': { section: lang === 'EN' ? 'BATCHES' : 'QUẢN LÝ LÔ', title: lang === 'EN' ? 'Create New Batch' : 'Khởi tạo lô mới' },
    'batch-detail': { section: lang === 'EN' ? 'BATCHES' : 'QUẢN LÝ LÔ', title: lang === 'EN' ? `Batch Details #${routeInfo.batchId || ''}` : `Chi tiết lô #${routeInfo.batchId || ''}` },
    'batch-edit': { section: lang === 'EN' ? 'BATCHES' : 'QUẢN LÝ LÔ', title: lang === 'EN' ? `Edit Batch #${routeInfo.batchId || ''}` : `Hiệu chỉnh lô #${routeInfo.batchId || ''}` },
    'audit-logs': { section: lang === 'EN' ? 'ADMINISTRATION' : 'QUẢN TRỊ', title: lang === 'EN' ? 'Audit Log & Hash Verification' : 'Nhật ký kiểm toán & Chuỗi băm' },
    profile: { section: lang === 'EN' ? 'ACCOUNT' : 'TÀI KHOẢN', title: lang === 'EN' ? 'User Profile' : 'Hồ sơ cá nhân' },
  }[routeInfo.name] || { section: 'HỆ THỐNG', title: 'Truy xuất nguồn gốc' }

  const isBatchesActive = route.startsWith('/batches')

  return (
    <div className="workspace">
      <aside className="sidebar">
        <Brand />
        <span className="sidebar-label">Không gian làm việc</span>
        <nav aria-label="Điều hướng chính">
          <button
            type="button"
            className={`nav-link ${routeInfo.name === 'dashboard' ? 'active' : ''}`}
            onClick={() => navigate('/dashboard')}
          >
            <IconDashboard /> <span>{lang === 'EN' ? 'Overview' : 'Tổng quan'}</span>
          </button>
          <button
            type="button"
            className={`nav-link ${isBatchesActive ? 'active' : ''}`}
            onClick={() => navigate('/batches')}
          >
            <IconBatches /> <span>{lang === 'EN' ? 'Batches' : 'Quản lý lô'}</span>
          </button>
          {profile?.role === 'ADMIN' && (
            <button
              type="button"
              className={`nav-link ${routeInfo.name === 'audit-logs' ? 'active' : ''}`}
              onClick={() => navigate('/audit-logs')}
            >
              <IconShield /> <span>{lang === 'EN' ? 'Audit Logs' : 'Nhật ký kiểm toán'}</span>
            </button>
          )}
          <button
            type="button"
            className="nav-link"
            onClick={() => navigate(preview ? '/trace?preview=1' : '/trace')}
          >
            <IconSearch /> <span>{lang === 'EN' ? 'Public Trace' : 'Tra cứu công khai'}</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <button className="logout-button with-icon" type="button" onClick={() => onLogout()}>
            <IconLogout /> <span>{lang === 'EN' ? 'Sign out' : 'Đăng xuất'}</span>
          </button>
        </div>
      </aside>

      <main className="workspace-main">
        <header className="workspace-topbar">
          <div className="topbar-left">
            <span className="topbar-label">{topbarMeta.section}</span>
            <span className="topbar-separator">/</span>
            <strong>{topbarMeta.title}</strong>
          </div>

          <div className="topbar-right">
            {/* 1. Chuông thông báo */}
            <div className="notification-wrapper">
              <button
                type="button"
                className={`topbar-tool-btn ${showNotifications ? 'active' : ''}`}
                title="Thông báo hệ thống"
                aria-label="Thông báo"
                onClick={() => setShowNotifications((prev) => !prev)}
              >
                <IconBell />
                {unreadCount > 0 && <span className="tool-badge-dot" />}
              </button>

              {showNotifications && (
                <div className="notifications-dropdown" role="dialog" aria-label="Thông báo hệ thống">
                  <div className="notif-header">
                    <strong>Thông báo hệ thống ({unreadCount})</strong>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        className="notif-read-all-btn"
                        onClick={markAllNotificationsRead}
                      >
                        Đã đọc tất cả
                      </button>
                    )}
                  </div>
                  <div className="notif-list">
                    {notifications.map((n) => (
                      <div key={n.id} className={`notif-item ${n.unread ? 'unread' : ''}`}>
                        <div className="notif-title-row">
                          <strong className="notif-title">{n.title}</strong>
                          <span className="notif-time">{n.time}</span>
                        </div>
                        <p className="notif-desc">{n.desc}</p>
                      </div>
                    ))}
                  </div>
                  <div className="notif-footer">
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setShowNotifications(false)}
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Tùy chọn ngôn ngữ VN / EN */}
            <button
              type="button"
              className="topbar-tool-btn lang-btn"
              title="Chuyển đổi ngôn ngữ"
              onClick={() => setLang((curr) => (curr === 'VN' ? 'EN' : 'VN'))}
            >
              <IconGlobe />
              <span className="lang-label">{lang}</span>
            </button>

            {/* 3. Avatar + Tên + Vai trò -> Bấm vào mở Profile */}
            <button
              type="button"
              className="topbar-profile-btn"
              title="Nhấn để mở và chỉnh sửa Hồ sơ cá nhân"
              onClick={() => navigate('/profile')}
            >
              <span className="topbar-avatar" aria-hidden="true">
                {(profile?.name || 'U')[0]}
              </span>
              <div className="topbar-user-text">
                <span className="user-name">{profile?.name || 'Tài khoản'}</span>
                <span className="user-role">{ROLE_LABELS[profile?.role] || profile?.role || 'Thành viên'}</span>
              </div>
            </button>
          </div>
        </header>

        <header className="mobile-header">
          <Brand />
          <div className="mobile-header-actions">
            <button
              type="button"
              className="topbar-tool-btn sm"
              onClick={() => setLang((curr) => (curr === 'VN' ? 'EN' : 'VN'))}
            >
              <span className="lang-label">{lang}</span>
            </button>
            <button className="text-button" type="button" onClick={() => onLogout()}>
              Đăng xuất
            </button>
          </div>
        </header>

        <nav className="mobile-nav" aria-label="Điều hướng di động">
          <button
            type="button"
            className={routeInfo.name === 'dashboard' ? 'active' : ''}
            onClick={() => navigate('/dashboard')}
          >
            Tổng quan
          </button>
          <button
            type="button"
            className={isBatchesActive ? 'active' : ''}
            onClick={() => navigate('/batches')}
          >
            Lô hàng
          </button>
          {profile?.role === 'ADMIN' && (
            <button
              type="button"
              className={routeInfo.name === 'audit-logs' ? 'active' : ''}
              onClick={() => navigate('/audit-logs')}
            >
              Kiểm toán
            </button>
          )}
          <button
            type="button"
            className={routeInfo.name === 'profile' ? 'active' : ''}
            onClick={() => navigate('/profile')}
          >
            Hồ sơ
          </button>
          <button
            type="button"
            onClick={() => navigate(preview ? '/trace?preview=1' : '/trace')}
          >
            Tra cứu QR
          </button>
        </nav>

        <div className="workspace-content">
          {preview && (
            <div className="preview-banner" role="status">
              <strong><IconSparkles /> Bản hoàn thiện giao diện Quản lý chuỗi cung ứng & Kiểm toán (W8-Hoài Bảo)</strong> — Đầy đủ giao diện theo vai trò (Farmer, Processor, Distributor, Admin), responsive đa thiết bị, nhật ký kiểm toán và xác thực chuỗi băm mật mã.
            </div>
          )}

          {flash && <Notice message={flash} success />}

          {loading ? (
            <p role="status">Đang tải thông tin tài khoản…</p>
          ) : loadError ? (
            <div className="state-block" role="alert">
              <h1>Không thể tải dữ liệu</h1>
              <p>{loadError}</p>
              <button
                className="button secondary"
                type="button"
                onClick={() => {
                  setLoading(true)
                  setRetry((value) => value + 1)
                }}
              >
                Thử lại
              </button>
            </div>
          ) : routeInfo.name === 'batch-new' ? (
            <BatchForm
              mode="create"
              token={token}
              user={profile}
              preview={preview}
              onSuccess={(newBatch, msg) => {
                navigate(`/batches/${newBatch.batchId}`)
                if (onFlash) onFlash(msg)
              }}
              onCancel={() => navigate('/batches')}
            />
          ) : routeInfo.name === 'batch-edit' ? (
            <BatchForm
              mode="update"
              batch={
                preview
                  ? PREVIEW_BATCHES.find((b) => b.batchId === routeInfo.batchId) || PREVIEW_BATCHES[0]
                  : null
              }
              batchId={routeInfo.batchId}
              token={token}
              user={profile}
              preview={preview}
              onSuccess={(updated, msg) => {
                navigate(`/batches/${updated.batchId}`)
                if (onFlash) onFlash(msg)
              }}
              onCancel={() => navigate(`/batches/${routeInfo.batchId}`)}
            />
          ) : routeInfo.name === 'batch-detail' || routeInfo.name === 'batch-timeline' ? (
            <BatchDetail
              batchId={routeInfo.batchId}
              token={token}
              user={profile}
              preview={preview}
              onBack={() => navigate('/batches')}
              onEdit={(b) => navigate(`/batches/${b.batchId}/edit`)}
            />
          ) : routeInfo.name === 'batches' ? (
            <BatchList
              token={token}
              user={profile}
              preview={preview}
              onOpenBatch={(id) => navigate(`/batches/${id}`)}
              onCreateBatch={() => navigate('/batches/new')}
              onEditBatch={(b) => navigate(`/batches/${b.batchId}/edit`)}
            />
          ) : routeInfo.name === 'audit-logs' ? (
            <AuditLogView
              token={token}
              preview={preview}
              onOpenBatch={(id) => navigate(`/batches/${id}`)}
            />
          ) : routeInfo.name === 'profile' ? (
            <>
              <div className="page-heading">
                <span className="eyebrow">TÀI KHOẢN</span>
                <h1>Hồ sơ cá nhân</h1>
                <p>Quản lý thông tin hiển thị và xem quyền truy cập của bạn.</p>
              </div>
              <div className="profile-identity">
                <span className="profile-avatar" aria-hidden="true">
                  {(profile.name || 'U')[0]}
                </span>
                <div>
                  <strong>{profile.name}</strong>
                  <span>{profile.email}</span>
                </div>
                <span className="account-state">
                  <span />
                  {profile.status === 'ACTIVE' ? 'Đang hoạt động' : profile.status}
                </span>
              </div>
              <div className="profile-layout">
                <section className="profile-section">
                  <div className="section-heading">
                    <div>
                      <span className="section-index">01</span>
                      <h2>Thông tin cá nhân</h2>
                    </div>
                    <p>Chỉnh sửa tên hiển thị của bạn.</p>
                  </div>
                  <Notice message={saveError} />
                  <Notice message={saved ? 'Đã cập nhật họ và tên.' : ''} success />
                  <form onSubmit={saveName} noValidate>
                    <Field
                      name="profile-name"
                      label="Họ và tên"
                      placeholder="Họ và tên"
                      value={name}
                      error={nameError}
                      onChange={(event) => {
                        setName(event.target.value)
                        setNameError('')
                        setSaved(false)
                      }}
                    />
                    <button
                      className="button primary"
                      type="submit"
                      disabled={preview || saving || name.trim() === profile.name}
                    >
                      {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
                    </button>
                  </form>
                </section>
                <section className="profile-section">
                  <div className="section-heading">
                    <div>
                      <span className="section-index">02</span>
                      <h2>Thông tin tài khoản</h2>
                    </div>
                    <p>Do hệ thống quản lý.</p>
                  </div>
                  <dl className="facts">
                    <div>
                      <dt>Email</dt>
                      <dd>{profile.email || '—'}</dd>
                    </div>
                    <div>
                      <dt>Vai trò</dt>
                      <dd>{ROLE_LABELS[profile.role] || profile.role || '—'}</dd>
                    </div>
                    <div>
                      <dt>Trạng thái</dt>
                      <dd>
                        {profile.status === 'ACTIVE' ? 'Đang hoạt động' : profile.status || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Đơn vị</dt>
                      <dd>
                        {profile.organizationName ||
                          profile.organization?.name ||
                          (profile.organizationId
                            ? `Mã đơn vị: ${profile.organizationId}`
                            : 'HTX Cà phê Cầu Đất')}
                      </dd>
                    </div>
                  </dl>
                </section>
              </div>
            </>
          ) : (
            /* Dashboard View */
            <div className="dashboard-view">
              <div className="page-heading">
                <span className="eyebrow">TỔNG QUAN HỆ THỐNG</span>
                <h1>Xin chào, {profile.name}</h1>
                <p>
                  Chào mừng bạn quay lại Hệ thống truy xuất nguồn gốc và minh bạch chuỗi cung ứng thực phẩm.
                </p>
                <div style={{ marginTop: 14 }}>
                  <span className="role-badge">
                    {ROLE_LABELS[profile.role] || profile.role}
                  </span>
                  {profile.organizationName && (
                    <span style={{ marginLeft: 10, fontSize: 13, color: 'var(--muted)', fontWeight: 650, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <IconBuilding /> {profile.organizationName}
                    </span>
                  )}
                </div>
              </div>

              {/* Role-Specific Metric KPIs */}
              <div className="dashboard-kpi-grid">
                {profile.role === 'FARMER' && (
                  <>
                    <div className="kpi-card-metric">
                      <span className="metric-tag">NÔNG TRẠI</span>
                      <strong className="metric-num">6</strong>
                      <span className="metric-title">Tổng số lô nông sản</span>
                      <span className="metric-desc">Được canh tác theo tiêu chuẩn sạch</span>
                    </div>
                    <div className="kpi-card-metric highlight-orange">
                      <span className="metric-tag">SẴN SÀNG</span>
                      <strong className="metric-num">1</strong>
                      <span className="metric-title">Chờ thu gom / Vận chuyển</span>
                      <span className="metric-desc">Trạng thái mới tạo (CREATED)</span>
                    </div>
                    <div className="kpi-card-metric highlight-green">
                      <span className="metric-tag">THÀNH PHẨM</span>
                      <strong className="metric-num">1</strong>
                      <span className="metric-title">Đã xuất bán ra thị trường</span>
                      <span className="metric-desc">Đã giao chuỗi siêu thị (SHIPPED)</span>
                    </div>
                    <div className="kpi-card-metric highlight-teal">
                      <span className="metric-tag">CHỨNG NHẬN</span>
                      <strong className="metric-num">100%</strong>
                      <span className="metric-title">Chứng nhận canh tác VietGAP</span>
                      <span className="metric-desc">Có mã QR truy xuất từng lô</span>
                    </div>
                  </>
                )}
                {profile.role === 'PROCESSOR' && (
                  <>
                    <div className="kpi-card-metric highlight-blue">
                      <span className="metric-tag">ĐẾN NƠI</span>
                      <strong className="metric-num">1</strong>
                      <span className="metric-title">Chờ tiếp nhận nguyên liệu</span>
                      <span className="metric-desc">Đang trên đường chuyển đến (TRANSPORTED)</span>
                    </div>
                    <div className="kpi-card-metric highlight-orange">
                      <span className="metric-tag">GIA CÔNG</span>
                      <strong className="metric-num">2</strong>
                      <span className="metric-title">Đang sơ chế & Chế biến</span>
                      <span className="metric-desc">Quy trình rang sấy, đóng gói vô trùng</span>
                    </div>
                    <div className="kpi-card-metric highlight-purple">
                      <span className="metric-tag">ĐÓNG GÓI</span>
                      <strong className="metric-num">1</strong>
                      <span className="metric-title">Hoàn tất dán tem mã QR</span>
                      <span className="metric-desc">Sẵn sàng xuất kho sang nhà bán lẻ</span>
                    </div>
                    <div className="kpi-card-metric highlight-teal">
                      <span className="metric-tag">TIÊU CHUẨN</span>
                      <strong className="metric-num">ISO 22K</strong>
                      <span className="metric-title">Chuẩn HACCP & ISO 22000</span>
                      <span className="metric-desc">100% đạt kiểm nghiệm an toàn</span>
                    </div>
                  </>
                )}
                {profile.role === 'DISTRIBUTOR' && (
                  <>
                    <div className="kpi-card-metric highlight-blue">
                      <span className="metric-tag">LOGISTICS</span>
                      <strong className="metric-num">1</strong>
                      <span className="metric-title">Lô đang trên đường vận chuyển</span>
                      <span className="metric-desc">Container lạnh kiểm soát hành trình</span>
                    </div>
                    <div className="kpi-card-metric highlight-green">
                      <span className="metric-tag">ĐÃ GIAO</span>
                      <strong className="metric-num">1</strong>
                      <span className="metric-title">Đã giao siêu thị / Điểm bán</span>
                      <span className="metric-desc">Đã bàn giao đại lý (SHIPPED)</span>
                    </div>
                    <div className="kpi-card-metric highlight-teal">
                      <span className="metric-tag">NHIỆT ĐỘ</span>
                      <strong className="metric-num">4.8°C</strong>
                      <span className="metric-title">Nhiệt độ thùng lạnh trung bình</span>
                      <span className="metric-desc">Dải nhiệt tối ưu 2°C - 6°C</span>
                    </div>
                    <div className="kpi-card-metric highlight-purple">
                      <span className="metric-tag">ĐÚNG HẠN</span>
                      <strong className="metric-num">99.4%</strong>
                      <span className="metric-title">Tỷ lệ giao hàng đúng hẹn</span>
                      <span className="metric-desc">Thời gian vận chuyển cam kết</span>
                    </div>
                  </>
                )}
                {profile.role === 'ADMIN' && (
                  <>
                    <div className="kpi-card-metric">
                      <span className="metric-tag">TOÀN MẠNG</span>
                      <strong className="metric-num">6</strong>
                      <span className="metric-title">Tổng số lô nông sản hệ thống</span>
                      <span className="metric-desc">Theo dõi toàn diện các đơn vị</span>
                    </div>
                    <div className="kpi-card-metric highlight-blue">
                      <span className="metric-tag">SỰ KIỆN</span>
                      <strong className="metric-num">21</strong>
                      <span className="metric-title">Sự kiện chuỗi cung ứng</span>
                      <span className="metric-desc">Ghi nhận mốc luân chuyển hàng</span>
                    </div>
                    <div className="kpi-card-metric highlight-green">
                      <span className="metric-tag">BẢO MẬT</span>
                      <strong className="metric-num">100%</strong>
                      <span className="metric-title">Toàn vẹn chuỗi băm SHA-256</span>
                      <span className="metric-desc">Hash-chained không thể sửa đổi</span>
                    </div>
                    <div className="kpi-card-metric highlight-teal">
                      <span className="metric-tag">KIỂM TOÁN</span>
                      <strong className="metric-num">5</strong>
                      <span className="metric-title">Bản ghi nhật ký kiểm toán</span>
                      <span className="metric-desc">Lưu vết mọi thao tác thay đổi</span>
                    </div>
                  </>
                )}
              </div>

              {/* Fast Actions Banner */}
              <div className="overview-band" style={{ marginTop: 24 }}>
                <div>
                  <span className="eyebrow">
                    {profile.role === 'ADMIN' ? 'GIÁM SÁT HỆ THỐNG' : 'QUẢN LÝ LÔ HÀNG'}
                  </span>
                  <h2>
                    {profile.role === 'ADMIN'
                      ? 'Trung tâm giám sát tính toàn vẹn chuỗi cung ứng'
                      : profile.role === 'FARMER'
                      ? 'Trung tâm điều hành lô nông sản nông trại'
                      : profile.role === 'PROCESSOR'
                      ? 'Điều hành chế biến & Kiểm soát chất lượng'
                      : 'Điều hành vận chuyển & Phân phối nông sản'}
                  </h2>
                  <p>
                    {profile.role === 'ADMIN'
                      ? 'Kiểm toán hệ thống, kiểm tra tính toàn vẹn chuỗi băm mật mã và quản lý tài nguyên.'
                      : 'Tra cứu danh sách lô, kiểm tra mã QR truy xuất và theo dõi tiến trình luân chuyển.'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {(profile.role === 'FARMER' || preview) && (
                    <button
                      className="button primary"
                      type="button"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      onClick={() => navigate('/batches/new')}
                    >
                      <IconPlus /> Khởi tạo lô mới
                    </button>
                  )}
                  {profile.role === 'ADMIN' && (
                    <button
                      className="button primary"
                      type="button"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      onClick={() => navigate('/audit-logs')}
                    >
                      <IconShield /> Nhật ký kiểm toán & Chuỗi băm
                    </button>
                  )}
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => navigate('/batches')}
                  >
                    Xem tất cả lô →
                  </button>
                  <button
                    className="button secondary with-icon"
                    type="button"
                    onClick={() => navigate(preview ? '/trace?preview=1' : '/trace')}
                  >
                    <IconSearch /> Tra cứu QR công khai
                  </button>
                </div>
              </div>

              {/* Recent Batches Quick Glance */}
              <div style={{ marginTop: 36 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, color: 'var(--ink)' }}>Lô hàng gần đây</h3>
                    <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>Các lô nông sản được khởi tạo hoặc cập nhật mới nhất.</p>
                  </div>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => navigate('/batches')}
                  >
                    Xem toàn bộ ({PREVIEW_BATCHES.length}) →
                  </button>
                </div>

                <div className="batches-card-container">
                  <div className="table-responsive-desktop">
                    <table className="batches-table">
                      <thead>
                        <tr>
                          <th scope="col">Mã lô</th>
                          <th scope="col">Sản phẩm</th>
                          <th scope="col">Nơi xuất xứ</th>
                          <th scope="col" className="text-right">Sản lượng</th>
                          <th scope="col">Ngày tạo</th>
                          <th scope="col">Trạng thái</th>
                          <th scope="col" className="text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {PREVIEW_BATCHES.slice(0, 4).map((b) => (
                          <tr
                            key={b.batchId}
                            className="batch-row-item"
                            onClick={() => navigate(`/batches/${b.batchId}`)}
                          >
                            <td className="cell-batch-code">
                              <code className="batch-code-tag">{b.batchCode}</code>
                            </td>
                            <td className="cell-product-name">
                              <strong>{b.productName}</strong>
                            </td>
                            <td className="cell-origin">
                              <span className="origin-text">{b.origin}</span>
                            </td>
                            <td className="cell-quantity text-right">
                              <span className="quantity-val">{formatQuantity(b.quantity)}</span>
                            </td>
                            <td className="cell-date">
                              <span className="date-text">{formatDateOnly(b.creationDate)}</span>
                            </td>
                            <td className="cell-status">
                              <BatchStatusBadge status={b.currentStatus} />
                            </td>
                            <td className="cell-actions text-right" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="action-icon-btn view-btn"
                                onClick={() => navigate(`/batches/${b.batchId}`)}
                              >
                                Xem chi tiết →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function App() {
  const [route, setRoute] = useState(currentRoute)
  const [navState, setNavState] = useState(null)
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem('food-trace-user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [flash, setFlash] = useState('')

  useEffect(() => {
    const onPop = () => {
      setNavState(null)
      setRoute(currentRoute())
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((path, state = null) => {
    window.history.pushState({}, '', path)
    setNavState(state)
    setRoute(path)
    window.scrollTo(0, 0)
  }, [])

  const logout = useCallback((message = '') => {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem('food-trace-user')
    setToken(null)
    setUser(null)
    setNavState(null)
    window.history.replaceState({}, '', '/login')
    setRoute('/login')
    setFlash(message)
  }, [])

  const login = useCallback((result) => {
    sessionStorage.setItem(TOKEN_KEY, result.token)
    sessionStorage.setItem('food-trace-user', JSON.stringify(result.user))
    setToken(result.token)
    setUser(result.user)
    navigate('/batches')
  }, [navigate])

  const routeInfo = parseRoute(route)
  const isPublicTrace = routeInfo.name === 'trace-search' || routeInfo.name === 'trace-result'
  const isProtected = !isPublicTrace && routeInfo.name !== 'login' && routeInfo.name !== 'register'
  const isMockSession = Boolean(token && token.startsWith('mock-token-'))
  const hasPreviewParam =
    route.includes('preview=1') ||
    new URLSearchParams(window.location.search).get('preview') === '1'
  const isPublicPreview = Boolean(hasPreviewParam || isMockSession)
  const isPreview = Boolean(import.meta.env.DEV && hasPreviewParam && !token) || isMockSession

  useEffect(() => {
    if (routeInfo.name === 'trace-search') {
      document.title = 'Food Trace | Tra cứu nguồn gốc công khai'
    } else if (routeInfo.name === 'trace-result') {
      document.title = 'Food Trace | Kết quả truy xuất nguồn gốc'
    } else if (routeInfo.name === 'login' || routeInfo.name === 'register') {
      document.title = 'Food Trace | Tài khoản'
    } else {
      document.title = 'Food Trace | Quản lý chuỗi cung ứng'
    }
  }, [routeInfo.name])

  if (routeInfo.name === 'trace-search') {
    return (
      <PublicTraceSearch
        navigate={navigate}
        isAuthenticated={Boolean(token)}
        preview={isPublicPreview}
      />
    )
  }

  if (routeInfo.name === 'trace-result') {
    return (
      <PublicTraceResult
        key={`${routeInfo.mode}:${routeInfo.identifier}:${isPublicPreview}`}
        mode={routeInfo.mode}
        identifier={routeInfo.identifier}
        prefetchedTrace={navState?.prefetchedTrace || null}
        navigate={navigate}
        isAuthenticated={Boolean(token)}
        preview={isPublicPreview}
      />
    )
  }

  if (isPreview && !token) {
    return (
      <Workspace
        route={route}
        navigate={navigate}
        user={PREVIEW_USER}
        onLogout={logout}
        onUserUpdate={setUser}
        preview
        flash={flash}
        onFlash={setFlash}
      />
    )
  }

  if (isProtected && !token) {
    return <Login navigate={navigate} onLogin={login} flash={flash} />
  }

  if (token && (routeInfo.name === 'login' || routeInfo.name === 'register')) {
    return (
      <Workspace
        route="/batches"
        navigate={navigate}
        token={token}
        user={user}
        onLogout={logout}
        onUserUpdate={setUser}
        preview={isMockSession}
        flash={flash}
        onFlash={setFlash}
      />
    )
  }

  if (routeInfo.name === 'register') return <Register navigate={navigate} />
  if (routeInfo.name === 'login') return <Login navigate={navigate} onLogin={login} flash={flash} />

  return (
    <Workspace
      route={route}
      navigate={navigate}
      token={token}
      user={user}
      onLogout={logout}
      onUserUpdate={setUser}
      preview={isMockSession}
      flash={flash}
      onFlash={setFlash}
    />
  )
}

export default App
