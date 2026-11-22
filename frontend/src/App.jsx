import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, api, errorMessage } from './api.js'
import './App.css'
import { BatchList } from './batches/BatchList.jsx'
import { BatchDetail } from './batches/BatchDetail.jsx'
import { BatchForm } from './batches/BatchForm.jsx'
import { BatchQrModal } from './batches/BatchQrModal.jsx'
import { BatchStatusBadge } from './batches/BatchStatusBadge.jsx'
import { AuditLogView } from './admin/AuditLogView.jsx'
import { UserManagementView } from './admin/UserManagementView.jsx'
import { OrganizationManagementView } from './admin/OrganizationManagementView.jsx'
import { PipelineView } from './pages/PipelineView.jsx'
import { ReportsView } from './pages/ReportsView.jsx'
import { QrCenterView } from './pages/QrCenterView.jsx'
import { HelpView } from './pages/HelpView.jsx'
import { PublicTraceSearch } from './trace/PublicTraceSearch.jsx'
import { PublicTraceResult } from './trace/PublicTraceResult.jsx'
import { buildTraceRoute, parseTraceInput, parseTraceRoute } from './trace/traceUtils.js'
import { BrandLogo, WorkspaceFooter } from './components/BrandAndFooter.jsx'
import {
  BATCH_STATUSES,
  ROLE_LABELS_VI,
  STATUS_META,
  formatDateOnly,
  formatQuantity,
  resolveBatchImage,
} from './batches/batchConstants.js'
import {
  IconDashboard,
  IconBatches,
  IconPackage,
  IconChartBar,
  IconBook,
  IconUsersGroup,
  IconLogout,
  IconBell,
  IconPlus,
  IconBuilding,
  IconShield,
  IconCheck,
  IconSearch,
  IconQr,
  IconUser,
} from './components/Icons.jsx'

const TOKEN_KEY = 'food-trace-token'

const ROLE_LABELS = ROLE_LABELS_VI

function parseRoute(path) {
  const cleanPath = String(path || '/').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/'
  if (cleanPath === '/') return { name: 'trace-search' }
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
  if (cleanPath === '/pipeline') return { name: 'pipeline' }
  if (cleanPath === '/reports') return { name: 'reports' }
  if (cleanPath === '/qr-center') return { name: 'qr-center' }
  if (cleanPath === '/help') return { name: 'help' }
  if (cleanPath === '/audit-logs') return { name: 'audit-logs' }
  if (cleanPath === '/admin/users') return { name: 'admin-users' }
  if (cleanPath === '/admin/organizations') return { name: 'admin-orgs' }
  if (cleanPath === '/profile') return { name: 'profile' }
  if (cleanPath === '/dashboard') return { name: 'dashboard' }
  if (cleanPath === '/register') return { name: 'register' }
  if (cleanPath === '/login') return { name: 'login' }
  return { name: 'trace-search' }
}

function currentRoute() {
  const path = window.location.pathname || '/'
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
      {children || (
        <div className="input-wrap">
          <input
            id={name}
            name={name}
            type={isPassword && visible ? 'text' : type}
            autoComplete={autoComplete}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${name}-error` : undefined}
          />
          {isPassword && (
            <button
              type="button"
              className="password-toggle"
              onClick={() => setVisible((current) => !current)}
              aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {visible ? 'Ẩn' : 'Hiện'}
            </button>
          )}
        </div>
      )}
      {error && <span id={`${name}-error`} className="field-error">{error}</span>}
    </div>
  )
}

function Notice({ message, success = false }) {
  return message ? (
    <div className={`notice ${success ? 'success' : 'error'}`} role={success ? 'status' : 'alert'}>
      {message}
    </div>
  ) : null
}

function AuthShell({ title, subtitle, navigate, children }) {
  return (
    <div className="auth-immersive-shell">
      {/* Background hình ảnh thực phẩm phủ toàn màn hình với hiệu ứng mờ nhẹ */}
      <div className="auth-backdrop" aria-hidden="true">
        <img className="auth-backdrop-img" src="/account-produce.jpg" alt="" />
        <div className="auth-backdrop-overlay" />
      </div>

      <header className="auth-immersive-topbar">
        <button type="button" className="pub-brand-btn" onClick={() => navigate('/trace')}>
          <BrandLogo invert />
        </button>
        <button
          type="button"
          className="btn-portal-public-trace with-icon"
          onClick={() => navigate('/trace')}
        >
          <IconQr /> Cổng tra cứu công khai
        </button>
      </header>

      <main className="auth-immersive-body">
        <div className="auth-card-prominent">
          <div className="auth-card-top-tag">
            <span className="auth-tag-dot" /> CỔNG ĐỐI TÁC CHUỖI CUNG ỨNG
          </div>
          <div className="auth-heading">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          {children}
        </div>
      </main>

      <footer className="auth-immersive-footer">
        © 2026 Food Trace Vietnam <span>·</span> Cổng thông tin truy xuất nguồn gốc nông sản an toàn
      </footer>
    </div>
  )
}

function Login({ navigate, onLogin, flash }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const next = {}
    if (!form.email.trim()) next.email = 'Vui lòng nhập email.'
    else if (!validateEmail(form.email.trim())) next.email = 'Email không hợp lệ.'
    if (!form.password) next.password = 'Vui lòng nhập mật khẩu.'
    setErrors(next)
    setMessage('')
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      const result = await api.login({ email: form.email.trim(), password: form.password })
      if (!result?.token || !result?.user) throw new ApiError(502, 'INVALID_RESPONSE')
      onLogin({ token: result.token, user: result.user })
    } catch (error) {
      setMessage(errorMessage(error))
      setForm((current) => ({ ...current, password: '' }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Đăng nhập đối tác"
      subtitle="Truy cập không gian quản trị lô hàng và chuỗi cung ứng thực phẩm."
      navigate={navigate}
    >
      <Notice message={flash} success />
      <Notice message={message} />

      <form onSubmit={submit} noValidate>
        <Field
          name="login-email"
          label="Email tài khoản"
          type="email"
          autoComplete="username"
          placeholder="ten@donvi.vn"
          value={form.email}
          error={errors.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
        <Field
          name="login-password"
          label="Mật khẩu"
          type="password"
          autoComplete="current-password"
          placeholder="Nhập mật khẩu"
          value={form.password}
          error={errors.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
        />
        <button className="button primary wide" type="submit" disabled={busy}>
          {busy ? 'Đang xác thực…' : 'Đăng nhập'}
        </button>
      </form>

      <p className="auth-switch">
        Chưa có tài khoản đối tác?{' '}
        <button type="button" className="text-button" onClick={() => navigate('/register')}>
          Đăng ký ngay
        </button>
      </p>
    </AuthShell>
  )
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
      next.password = 'Mật khẩu cần ít nhất 8 ký tự, có cả chữ và số.'
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
      if (error instanceof ApiError && error.details) {
        const fieldErrors = {}
        for (const d of error.details) fieldErrors[d.field] = d.message
        setErrors(fieldErrors)
      }
      setMessage(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Đăng ký tài khoản"
      subtitle="Tham gia mạng lưới truy xuất nguồn gốc chuỗi cung ứng thực phẩm."
      navigate={navigate}
    >
      {done ? (
        <div className="completion">
          <span className="completion-mark" aria-hidden="true"><IconCheck /></span>
          <h2>Đăng ký thành công</h2>
          <p>
            Tài khoản của bạn đã được ghi nhận ở trạng thái chờ duyệt. Quản trị viên sẽ gán đơn vị và kích hoạt để bạn bắt đầu sử dụng.
          </p>
          <button className="button primary wide" type="button" onClick={() => navigate('/login')}>
            Về trang đăng nhập
          </button>
        </div>
      ) : (
        <>
          <Notice message={message} />
          <form onSubmit={submit} noValidate>
            <Field
              name="name"
              label="Họ và tên"
              autoComplete="name"
              placeholder="Nguyễn Văn A"
              value={form.name}
              error={errors.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
            <Field
              name="email"
              label="Email công việc"
              type="email"
              autoComplete="email"
              placeholder="ten@donvi.vn"
              value={form.email}
              error={errors.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
            <div className="form-row-2col">
              <Field
                name="password"
                label="Mật khẩu"
                type="password"
                autoComplete="new-password"
                placeholder="Ít nhất 8 ký tự"
                value={form.password}
                error={errors.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
              <Field
                name="confirm"
                label="Xác nhận mật khẩu"
                type="password"
                autoComplete="new-password"
                placeholder="Nhập lại mật khẩu"
                value={form.confirm}
                error={errors.confirm}
                onChange={(event) => setForm({ ...form, confirm: event.target.value })}
              />
            </div>
            <Field name="role" label="Vai trò trong chuỗi cung ứng" error={errors.role}>
              <select
                id="role"
                name="role"
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value })}
                aria-invalid={Boolean(errors.role)}
              >
                <option value="">Chọn vai trò phù hợp</option>
                <option value="FARMER">Nông trại / Nhà sản xuất</option>
                <option value="PROCESSOR">Cơ sở chế biến</option>
                <option value="DISTRIBUTOR">Đơn vị vận chuyển & Phân phối</option>
              </select>
            </Field>
            <button className="button primary wide" type="submit" disabled={busy}>
              {busy ? 'Đang gửi đăng ký…' : 'Tạo tài khoản'}
            </button>
          </form>
          <p className="auth-switch">
            Đã có tài khoản?{' '}
            <button type="button" className="text-button" onClick={() => navigate('/login')}>
              Đăng nhập
            </button>
          </p>
        </>
      )}
    </AuthShell>
  )
}

function Workspace({
  route,
  navigate,
  token,
  user,
  onLogout,
  onUserUpdate,
  flash = '',
  onFlash,
}) {
  const [profile, setProfile] = useState(() => user || null)
  const [name, setName] = useState(() => user?.name || '')
  const [loading, setLoading] = useState(() => !user)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const [nameError, setNameError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const [topSearch, setTopSearch] = useState('')
  const [quickQrBatch, setQuickQrBatch] = useState(null)
  const routeInfo = parseRoute(route)

  const [dashboardBatches, setDashboardBatches] = useState([])
  const [dashboardError, setDashboardError] = useState('')
  const [dashboardRetry, setDashboardRetry] = useState(0)
  const [awaitingCount, setAwaitingCount] = useState(0)
  const [pendingUsersCount, setPendingUsersCount] = useState(0)

  useEffect(() => {
    if (!token) return
    let active = true
    api
      .listBatches(token, { limit: 100 })
      .then((data) => {
        if (!active) return
        setDashboardBatches(Array.isArray(data?.items) ? data.items : [])
        setDashboardError('')
      })
      .catch((err) => {
        if (!active) return
        setDashboardError(errorMessage(err))
      })

    if (profile?.role === 'PROCESSOR' || profile?.role === 'DISTRIBUTOR') {
      api
        .listBatches(token, { scope: 'awaiting', limit: 100 })
        .then((data) => {
          if (active) setAwaitingCount(data?.total || 0)
        })
        .catch(() => {})
    }

    if (profile?.role === 'ADMIN') {
      api
        .listUsers(token, { status: 'PENDING', limit: 1 })
        .then((data) => {
          if (active) setPendingUsersCount(data?.total || 0)
        })
        .catch(() => {})
    }

    return () => { active = false }
  }, [token, profile?.role, route, dashboardRetry])

  useEffect(() => {
    if (!token) return
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
  }, [token, retry, onLogout, onUserUpdate])

  async function saveName(event) {
    event.preventDefault()
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

  function handleTopQuickTrace(e) {
    e.preventDefault()
    const parsed = parseTraceInput(topSearch)
    if (!parsed.valid) return
    navigate(buildTraceRoute(parsed.mode, parsed.identifier))
    setTopSearch('')
  }

  const [showNotifications, setShowNotifications] = useState(false)
  const [readNotifIds, setReadNotifIds] = useState(() => new Set())

  const notifications = useMemo(() => {
    const items = []
    if (profile?.role === 'ADMIN' && pendingUsersCount > 0) {
      items.push({
        id: 'pending-users',
        title: `Có ${pendingUsersCount} tài khoản chờ duyệt`,
        desc: 'Cần gán đơn vị và kích hoạt để đối tác bắt đầu thao tác.',
        time: 'Hiện tại',
        route: '/admin/users',
      })
    }
    if ((profile?.role === 'PROCESSOR' || profile?.role === 'DISTRIBUTOR') && awaitingCount > 0) {
      items.push({
        id: 'awaiting-batches',
        title: `Có ${awaitingCount} lô hàng chờ tiếp nhận`,
        desc: 'Mở tab "Chờ tiếp nhận" trong Quản lý lô hàng để xử lý.',
        time: 'Hiện tại',
        route: '/batches',
      })
    }
    for (const b of dashboardBatches.slice(0, 3)) {
      items.push({
        id: `batch-${b.batchId}-${b.currentStatus}`,
        title: `${b.batchCode} · ${b.productName}`,
        desc: `Trạng thái: ${STATUS_META[b.currentStatus]?.label || b.currentStatus}`,
        time: formatDateOnly(b.creationDate),
        route: `/batches/${b.batchId}`,
      })
    }
    return items.map((item) => ({ ...item, unread: !readNotifIds.has(item.id) }))
  }, [profile?.role, pendingUsersCount, awaitingCount, dashboardBatches, readNotifIds])

  const unreadCount = notifications.filter((n) => n.unread).length

  const totalBatches = dashboardBatches.length
  const createdBatches = dashboardBatches.filter((b) => b.currentStatus === 'CREATED').length
  const transportedBatches = dashboardBatches.filter((b) => b.currentStatus === 'TRANSPORTED').length
  const receivedBatches = dashboardBatches.filter((b) => b.currentStatus === 'RECEIVED').length
  const processingBatches = dashboardBatches.filter((b) => ['RECEIVED', 'PROCESSED'].includes(b.currentStatus)).length
  const packagedBatches = dashboardBatches.filter((b) => b.currentStatus === 'PACKAGED').length
  const shippedBatches = dashboardBatches.filter((b) => b.currentStatus === 'SHIPPED').length
  const inChainBatches = dashboardBatches.filter((b) =>
    ['TRANSPORTED', 'RECEIVED', 'PROCESSED', 'PACKAGED'].includes(b.currentStatus)
  ).length

  const topbarMeta = {
    dashboard: { section: 'Tổng quan', title: 'Bảng điều khiển chuỗi cung ứng' },
    batches: { section: 'Lô hàng', title: 'Danh sách lô chuẩn FR-' },
    'batch-new': { section: 'Lô hàng', title: 'Khởi tạo lô thực phẩm mới' },
    'batch-detail': { section: 'Lô hàng', title: `Chi tiết lô #${routeInfo.batchId || ''}` },
    'batch-edit': { section: 'Lô hàng', title: `Hiệu chỉnh lô #${routeInfo.batchId || ''}` },
    pipeline: { section: 'Điều phối', title: 'Bảng theo dõi chuỗi cung ứng' },
    reports: { section: 'Thống kê', title: 'Báo cáo sản lượng & chứng nhận' },
    'qr-center': { section: 'Mã hóa số', title: 'Trung tâm in tem QR hàng loạt' },
    help: { section: 'Trợ giúp', title: 'Hướng dẫn quy chuẩn & giải đáp' },
    'audit-logs': { section: 'Quản trị', title: 'Nhật ký kiểm toán & SHA-256' },
    'admin-users': { section: 'Quản trị', title: 'Quản lý tài khoản & Phân quyền' },
    'admin-orgs': { section: 'Quản trị', title: 'Quản lý đơn vị chuỗi cung ứng' },
    profile: { section: 'Tài khoản', title: 'Hồ sơ cá nhân' },
  }[routeInfo.name] || { section: 'Hệ thống', title: 'Food Trace' }

  const isBatchesActive = route.startsWith('/batches') && routeInfo.name !== 'batch-new'
  const isFarmer = profile?.role === 'FARMER'
  const isAdmin = profile?.role === 'ADMIN'

  return (
    <div className="workspace">
      {/* Soft Light-Sage Professional Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-top-brand">
          <button type="button" className="pub-brand-btn" onClick={() => navigate('/dashboard')}>
            <BrandLogo invert />
          </button>
        </div>

        <div className="sidebar-nav-groups">
          <div className="sidebar-group">
            <span className="sidebar-label">Vận hành chuỗi cung ứng</span>
            <nav aria-label="Điều hướng chính">
              <button
                type="button"
                className={`nav-link ${routeInfo.name === 'dashboard' ? 'active' : ''}`}
                onClick={() => navigate('/dashboard')}
              >
                <IconDashboard /> <span>Tổng quan</span>
              </button>
              <button
                type="button"
                className={`nav-link ${isBatchesActive ? 'active' : ''}`}
                onClick={() => navigate('/batches')}
              >
                <IconPackage /> <span>Quản lý lô hàng</span>
              </button>
              {isFarmer && (
                <button
                  type="button"
                  className={`nav-link ${routeInfo.name === 'batch-new' ? 'active' : ''}`}
                  onClick={() => navigate('/batches/new')}
                >
                  <IconPlus /> <span>Khởi tạo lô mới</span>
                </button>
              )}
              <button
                type="button"
                className="nav-link"
                onClick={() => navigate('/trace')}
              >
                <IconQr /> <span>Cổng tra cứu QR</span>
              </button>
            </nav>
          </div>

          <div className="sidebar-group">
            <span className="sidebar-label">Công cụ chuỗi cung ứng</span>
            <nav aria-label="Điều hướng công cụ">
              <button
                type="button"
                className={`nav-link ${routeInfo.name === 'reports' ? 'active' : ''}`}
                onClick={() => navigate('/reports')}
              >
                <IconChartBar /> <span>Báo cáo & Thống kê</span>
              </button>
              <button
                type="button"
                className={`nav-link ${routeInfo.name === 'help' ? 'active' : ''}`}
                onClick={() => navigate('/help')}
              >
                <IconBook /> <span>Hướng dẫn & Quy chuẩn</span>
              </button>
            </nav>
          </div>

          {isAdmin && (
            <div className="sidebar-group">
              <span className="sidebar-label">Quản trị hệ thống</span>
              <nav aria-label="Điều hướng quản trị">
                <button
                  type="button"
                  className={`nav-link ${routeInfo.name === 'admin-users' ? 'active' : ''}`}
                  onClick={() => navigate('/admin/users')}
                >
                  <IconUsersGroup /> <span>Tài khoản & Duyệt</span>
                </button>
                <button
                  type="button"
                  className={`nav-link ${routeInfo.name === 'admin-orgs' ? 'active' : ''}`}
                  onClick={() => navigate('/admin/organizations')}
                >
                  <IconBuilding /> <span>Đơn vị tham gia</span>
                </button>
                <button
                  type="button"
                  className={`nav-link ${routeInfo.name === 'audit-logs' ? 'active' : ''}`}
                  onClick={() => navigate('/audit-logs')}
                >
                  <IconShield /> <span>Kiểm toán SHA-256</span>
                </button>
              </nav>
            </div>
          )}

          <div className="sidebar-group">
            <span className="sidebar-label">Cá nhân</span>
            <nav aria-label="Điều hướng tài khoản">
              <button
                type="button"
                className={`nav-link ${routeInfo.name === 'profile' ? 'active' : ''}`}
                onClick={() => navigate('/profile')}
              >
                <IconUser /> <span>Hồ sơ cá nhân</span>
              </button>
            </nav>
          </div>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-user-chip" title={`${profile?.name || ''} - ${profile?.organizationName || ROLE_LABELS[profile?.role] || ''}`}>
            <span className="sidebar-avatar">{(profile?.name || 'U')[0]}</span>
            <div className="sidebar-user-meta">
              <strong>{profile?.name || 'Thành viên'}</strong>
              <small title={profile?.organizationName || ROLE_LABELS[profile?.role] || ''}>
                {profile?.organizationName || ROLE_LABELS[profile?.role] || ''}
              </small>
            </div>
          </div>
          <button className="logout-button with-icon" type="button" onClick={() => onLogout()}>
            <IconLogout /> <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Column: Sticky Header + Compact Content + Workspace Footer */}
      <main className="workspace-main">
        <header className="workspace-topbar">
          <div className="topbar-left">
            <span className="topbar-label">{topbarMeta.section}</span>
            <span className="topbar-separator">/</span>
            <strong>{topbarMeta.title}</strong>
          </div>

          <form className="topbar-quick-search" onSubmit={handleTopQuickTrace}>
            <IconSearch />
            <input
              type="text"
              value={topSearch}
              onChange={(e) => setTopSearch(e.target.value)}
              placeholder="Tra nhanh mã lô FR-2026-..."
              aria-label="Tra cứu nhanh mã lô công khai"
            />
          </form>

          <div className="topbar-right">
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
                    <strong>Thông báo ({unreadCount})</strong>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        className="notif-read-all-btn"
                        onClick={() => setReadNotifIds(new Set(notifications.map((n) => n.id)))}
                      >
                        Đã đọc tất cả
                      </button>
                    )}
                  </div>
                  <div className="notif-list">
                    {notifications.length === 0 ? (
                      <div className="notif-item">
                        <p className="notif-desc">Chưa có thông báo mới.</p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`notif-item ${n.unread ? 'unread' : ''}`}
                          onClick={() => {
                            setReadNotifIds((prev) => new Set([...prev, n.id]))
                            setShowNotifications(false)
                            if (n.route) navigate(n.route)
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setReadNotifIds((prev) => new Set([...prev, n.id]))
                              setShowNotifications(false)
                              if (n.route) navigate(n.route)
                            }
                          }}
                        >
                          <div className="notif-title-row">
                            <strong className="notif-title">{n.title}</strong>
                            <span className="notif-time">{n.time}</span>
                          </div>
                          <p className="notif-desc">{n.desc}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              className="topbar-profile-btn"
              title="Mở hồ sơ cá nhân"
              onClick={() => navigate('/profile')}
            >
              <span className="topbar-avatar" aria-hidden="true">
                {(profile?.name || 'U')[0]}
              </span>
              <div className="topbar-user-text">
                <span className="user-name">{profile?.name || 'Tài khoản'}</span>
                <span className="user-role">{ROLE_LABELS[profile?.role] || profile?.role}</span>
              </div>
            </button>
          </div>
        </header>

        <header className="mobile-header">
          <BrandLogo compact />
          <div className="mobile-header-actions">
            <button type="button" className="btn-soft-outline sm" onClick={() => navigate('/trace')}>
              QR
            </button>
            <button className="text-button" type="button" onClick={() => onLogout()}>
              Đăng xuất
            </button>
          </div>
        </header>

        <nav className="mobile-nav" aria-label="Điều hướng di động">
          <button type="button" className={routeInfo.name === 'dashboard' ? 'active' : ''} onClick={() => navigate('/dashboard')}>
            Tổng quan
          </button>
          <button type="button" className={isBatchesActive ? 'active' : ''} onClick={() => navigate('/batches')}>
            Lô hàng
          </button>
          {isAdmin && (
            <>
              <button type="button" className={routeInfo.name === 'admin-users' ? 'active' : ''} onClick={() => navigate('/admin/users')}>
                Tài khoản
              </button>
              <button type="button" className={routeInfo.name === 'admin-orgs' ? 'active' : ''} onClick={() => navigate('/admin/organizations')}>
                Đơn vị
              </button>
              <button type="button" className={routeInfo.name === 'audit-logs' ? 'active' : ''} onClick={() => navigate('/audit-logs')}>
                Kiểm toán
              </button>
            </>
          )}
          <button type="button" className={routeInfo.name === 'profile' ? 'active' : ''} onClick={() => navigate('/profile')}>
            Hồ sơ
          </button>
        </nav>

        <div className="workspace-content">
          {flash && <Notice message={flash} success />}

          {loading ? (
            <div className="state-block" role="status">
              <div className="spinner-olive" />
              <p>Đang tải không gian làm việc…</p>
            </div>
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
              onSuccess={(newBatch, msg) => {
                navigate(`/batches/${newBatch.batchId}`)
                if (onFlash) onFlash(msg)
              }}
              onCancel={() => navigate('/batches')}
            />
          ) : routeInfo.name === 'batch-edit' ? (
            <BatchForm
              mode="update"
              batchId={routeInfo.batchId}
              token={token}
              user={profile}
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
              onBack={() => navigate('/batches')}
              onEdit={(b) => navigate(`/batches/${b.batchId}/edit`)}
            />
          ) : routeInfo.name === 'batches' ? (
            <BatchList
              token={token}
              user={profile}
              onOpenBatch={(id) => navigate(`/batches/${id}`)}
              onCreateBatch={() => navigate('/batches/new')}
              onEditBatch={(b) => navigate(`/batches/${b.batchId}/edit`)}
            />
          ) : routeInfo.name === 'pipeline' ? (
            <PipelineView
              token={token}
              user={profile}
              onOpenBatch={(id) => navigate(`/batches/${id}`)}
              navigate={navigate}
            />
          ) : routeInfo.name === 'reports' ? (
            <ReportsView token={token} user={profile} />
          ) : routeInfo.name === 'qr-center' ? (
            <QrCenterView token={token} user={profile} />
          ) : routeInfo.name === 'help' ? (
            <HelpView />
          ) : routeInfo.name === 'admin-users' ? (
            <UserManagementView token={token} currentUser={profile} />
          ) : routeInfo.name === 'admin-orgs' ? (
            <OrganizationManagementView token={token} />
          ) : routeInfo.name === 'audit-logs' ? (
            <AuditLogView
              token={token}
              onOpenBatch={(id) => navigate(`/batches/${id}`)}
            />
          ) : routeInfo.name === 'profile' ? (
            <div className="profile-page-wrap">
              <div className="page-heading-row">
                <div>
                  <h1>Hồ sơ cá nhân</h1>
                  <p>Cập nhật tên hiển thị và kiểm tra vai trò truy cập của tài khoản.</p>
                </div>
              </div>

              <div className="profile-layout">
                <section className="profile-section">
                  <div className="profile-identity">
                    <span className="profile-avatar" aria-hidden="true">
                      {(profile.name || 'U')[0]}
                    </span>
                    <div>
                      <strong>{profile.name}</strong>
                      <span>{profile.email}</span>
                    </div>
                    <span className="user-status-pill st-active">
                      <span className="dot" /> {profile.status === 'ACTIVE' ? 'Đang hoạt động' : profile.status}
                    </span>
                  </div>

                  <Notice message={saveError} />
                  <Notice message={saved ? 'Đã cập nhật họ và tên thành công.' : ''} success />

                  <form onSubmit={saveName} noValidate>
                    <Field
                      name="profile-name"
                      label="Họ và tên hiển thị"
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
                      disabled={saving || name.trim() === profile.name}
                    >
                      {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
                    </button>
                  </form>
                </section>

                <section className="profile-section">
                  <h3>Thông tin phân quyền</h3>
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
                      <dt>Đơn vị</dt>
                      <dd>
                        {profile.organizationName ||
                          (profile.organizationId ? `Đơn vị #${profile.organizationId}` : 'Quản trị toàn hệ thống')}
                      </dd>
                    </div>
                    <div>
                      <dt>Trạng thái</dt>
                      <dd>{profile.status === 'ACTIVE' ? 'Đang hoạt động' : profile.status || '—'}</dd>
                    </div>
                  </dl>
                </section>
              </div>
            </div>
          ) : (
            /* Compact, Structured Dashboard View */
            <div className="dashboard-view">
              <div className="dashboard-welcome-row">
                <div>
                  <h1>Xin chào, {profile.name}</h1>
                  <p>
                    <span className="role-badge">{ROLE_LABELS[profile.role] || profile.role}</span>
                    {profile.organizationName && (
                      <span className="welcome-org">
                        <IconBuilding /> {profile.organizationName}
                      </span>
                    )}
                  </p>
                </div>
                <div className="dashboard-welcome-actions">
                  {isFarmer && (
                    <button className="button primary with-icon" type="button" onClick={() => navigate('/batches/new')}>
                      <IconPlus /> Khởi tạo lô FR-
                    </button>
                  )}
                  {isAdmin && (
                    <button className="button primary with-icon" type="button" onClick={() => navigate('/admin/users')}>
                      <IconUser /> Duyệt tài khoản
                    </button>
                  )}
                  <button className="button secondary with-icon" type="button" onClick={() => navigate('/batches')}>
                    <IconBatches /> Danh sách lô
                  </button>
                </div>
              </div>

              {/* 4 Compact Role-Specific KPIs */}
              {dashboardError && (
                <div className="notice error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <span>Không thể tải dữ liệu tổng quan: {dashboardError}</span>
                  <button
                    type="button"
                    className="button secondary sm"
                    onClick={() => setDashboardRetry((r) => r + 1)}
                  >
                    Thử lại
                  </button>
                </div>
              )}

              <div className="dashboard-kpi-grid">
                <div className="kpi-card-metric">
                  <span className="metric-tag">TỔNG QUAN</span>
                  <strong className="metric-num">{totalBatches}</strong>
                  <span className="metric-title">Lô trong phạm vi quản lý</span>
                </div>
                <div className="kpi-card-metric highlight-orange">
                  <span className="metric-tag">KHỞI TẠO</span>
                  <strong className="metric-num">{createdBatches}</strong>
                  <span className="metric-title">
                    {isFarmer ? 'Lô mới tạo (sửa được)' : 'Lô chờ thu gom'}
                  </span>
                </div>
                <div className="kpi-card-metric highlight-blue">
                  <span className="metric-tag">CHUỖI CUNG ỨNG</span>
                  <strong className="metric-num">
                    {profile.role === 'PROCESSOR'
                      ? processingBatches + packagedBatches
                      : profile.role === 'DISTRIBUTOR'
                      ? transportedBatches + receivedBatches
                      : inChainBatches}
                  </strong>
                  <span className="metric-title">
                    {profile.role === 'PROCESSOR' || profile.role === 'DISTRIBUTOR'
                      ? `Đang xử lý (+${awaitingCount} chờ nhận)`
                      : 'Đang lưu thông trong chuỗi'}
                  </span>
                </div>
                <div className="kpi-card-metric highlight-green">
                  <span className="metric-tag">HOÀN TẤT</span>
                  <strong className="metric-num">{shippedBatches}</strong>
                  <span className="metric-title">Đã xuất kho thị trường (6/6)</span>
                </div>
              </div>

              {/* Compact 2-Column Workspace Body: Left Recent Batches, Right Stage Breakdown & Quick Actions */}
              <div className="dashboard-split-grid">
                <section className="batches-card-container">
                  <div className="card-section-head">
                    <div>
                      <h3>Lô hàng gần đây</h3>
                      <p>Nhấn vào mã QR để xem tem truy xuất hoặc mở hành trình chi tiết.</p>
                    </div>
                    <button type="button" className="text-button" onClick={() => navigate('/batches')}>
                      Xem tất cả ({totalBatches}) →
                    </button>
                  </div>

                  {dashboardBatches.length === 0 ? (
                    <div className="batches-empty-state compact">
                      <p>Chưa có lô hàng nào trong danh sách của bạn.</p>
                      <button type="button" className="button primary sm" onClick={() => navigate('/batches')}>
                        Mở quản lý lô
                      </button>
                    </div>
                  ) : (
                    <div className="table-responsive-desktop">
                      <table className="batches-table">
                        <thead>
                          <tr>
                            <th scope="col">Mã lô</th>
                            <th scope="col">Sản phẩm</th>
                            <th scope="col" className="text-right">Sản lượng</th>
                            <th scope="col">Ngày tạo</th>
                            <th scope="col">Trạng thái</th>
                            <th scope="col" className="text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboardBatches.slice(0, 5).map((b) => (
                            <tr
                              key={b.batchId}
                              className="batch-row-item"
                              onClick={() => navigate(`/batches/${b.batchId}`)}
                            >
                              <td className="cell-batch-code">
                                <code className="batch-code-tag">{b.batchCode}</code>
                              </td>
                              <td className="cell-product-name">
                                <div className="product-cell-media">
                                  <img
                                    className="product-cell-thumb"
                                    src={resolveBatchImage(b)}
                                    alt={b.productName}
                                    onError={(e) => { e.currentTarget.src = '/products/warehouse.jpg' }}
                                  />
                                  <strong>{b.productName}</strong>
                                </div>
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
                                <div className="row-action-buttons">
                                  <button
                                    type="button"
                                    className="action-icon-btn qr-btn"
                                    onClick={() => setQuickQrBatch(b)}
                                  >
                                    <IconQr /> QR
                                  </button>
                                  <button
                                    type="button"
                                    className="action-icon-btn view-btn"
                                    onClick={() => navigate(`/batches/${b.batchId}`)}
                                  >
                                    Chi tiết
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <aside className="dashboard-side-col">
                  <div className="side-summary-card">
                    <h3>Phân bố 6 giai đoạn</h3>
                    <div className="stage-bars-list">
                      {BATCH_STATUSES.map((st) => {
                        const count = dashboardBatches.filter((b) => b.currentStatus === st).length
                        const pct = totalBatches ? Math.round((count / totalBatches) * 100) : 0
                        const meta = STATUS_META[st]
                        return (
                          <div key={st} className="stage-bar-row">
                            <div className="stage-bar-meta">
                              <span>{meta.shortLabel}</span>
                              <strong>{count} lô</strong>
                            </div>
                            <div className="chain-progress-track thin">
                              <div className="chain-progress-fill" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="side-summary-card warm-tint">
                    <h3>Thao tác nhanh</h3>
                    <div className="quick-links-stack">
                      <button type="button" className="quick-stack-btn" onClick={() => navigate('/trace')}>
                        <IconQr /> Mở cổng quét &amp; tra cứu QR công khai
                      </button>
                      {isAdmin && (
                        <>
                          <button type="button" className="quick-stack-btn" onClick={() => navigate('/admin/organizations')}>
                            <IconBuilding /> Quản lý danh sách đơn vị
                          </button>
                          <button type="button" className="quick-stack-btn" onClick={() => navigate('/audit-logs')}>
                            <IconShield /> Xác thực chuỗi băm SHA-256
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          )}
        </div>

        <WorkspaceFooter />
      </main>

      {quickQrBatch && (
        <BatchQrModal
          batch={quickQrBatch}
          token={token}
          onClose={() => setQuickQrBatch(null)}
        />
      )}
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
    setFlash('')
    navigate('/dashboard')
  }, [navigate])

  const routeInfo = parseRoute(route)
  const isPublicTrace = routeInfo.name === 'trace-search' || routeInfo.name === 'trace-result'
  const isProtected = !isPublicTrace && routeInfo.name !== 'login' && routeInfo.name !== 'register'

  useEffect(() => {
    if (routeInfo.name === 'trace-search') {
      document.title = 'Food Trace | Cổng Truy Xuất Nguồn Gốc Thực Phẩm'
    } else if (routeInfo.name === 'trace-result') {
      document.title = 'Food Trace | Kết quả truy xuất nguồn gốc'
    } else if (routeInfo.name === 'login' || routeInfo.name === 'register') {
      document.title = 'Food Trace | Cổng Đối Tác'
    } else {
      document.title = 'Food Trace | Quản lý Chuỗi Cung Ứng'
    }
  }, [routeInfo.name])

  if (routeInfo.name === 'trace-search') {
    return (
      <PublicTraceSearch
        navigate={navigate}
        isAuthenticated={Boolean(token)}
      />
    )
  }

  if (routeInfo.name === 'trace-result') {
    return (
      <PublicTraceResult
        key={`${routeInfo.mode}:${routeInfo.identifier}`}
        mode={routeInfo.mode}
        identifier={routeInfo.identifier}
        prefetchedTrace={navState?.prefetchedTrace || null}
        navigate={navigate}
        isAuthenticated={Boolean(token)}
      />
    )
  }

  if (isProtected && !token) {
    return <Login navigate={navigate} onLogin={login} flash={flash} />
  }

  if (token && (routeInfo.name === 'login' || routeInfo.name === 'register')) {
    return (
      <Workspace
        route="/dashboard"
        navigate={navigate}
        token={token}
        user={user}
        onLogout={logout}
        onUserUpdate={setUser}
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
      flash={flash}
      onFlash={setFlash}
    />
  )
}

export default App
