import { useCallback, useEffect, useState } from 'react'
import { ApiError, api, errorMessage } from './api.js'
import './App.css'

const TOKEN_KEY = 'food-trace-token'
const PREVIEW_USER = {
  name: 'Nguyễn Văn A',
  email: 'farmer@example.com',
  role: 'FARMER',
  status: 'ACTIVE',
  organizationName: 'Nông trại mẫu',
}
const ROLE_LABELS = {
  FARMER: 'Nhà sản xuất',
  PROCESSOR: 'Cơ sở chế biến',
  DISTRIBUTOR: 'Nhà phân phối',
  ADMIN: 'Quản trị viên',
}

function currentRoute() {
  const path = window.location.pathname
  return ['/login', '/register', '/profile', '/dashboard'].includes(path) ? path : '/login'
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function Field({ label, name, value, onChange, error, type = 'text', autoComplete, children }) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {children || <input id={name} name={name} type={type} autoComplete={autoComplete}
        value={value} onChange={onChange} aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined} />}
      {error && <span id={`${name}-error`} className="field-error">{error}</span>}
    </div>
  )
}

function Notice({ message, success = false }) {
  return message ? <div className={`notice ${success ? 'success' : 'error'}`}
    role={success ? 'status' : 'alert'}>{message}</div> : null
}

function Brand() {
  return <div className="brand"><span className="brand-mark" aria-hidden="true">✳</span>Food Trace</div>
}

function AuthShell({ title, subtitle, children }) {
  return (
    <div className="auth-shell">
      <div className="auth-photo" aria-hidden="true">
        <div className="photo-caption"><span>FOOD TRACE</span>
          <strong>Nguồn gốc rõ ràng.<br />Niềm tin bền vững.</strong></div>
      </div>
      <main className="auth-main">
        <div className="auth-content">
          <Brand />
          <div className="auth-heading"><h1>{title}</h1><p>{subtitle}</p></div>
          {children}
        </div>
        <footer>Food Supply Chain Traceability Portal</footer>
      </main>
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
      onLogin(result)
    } catch (error) {
      setMessage(errorMessage(error))
      setForm((current) => ({ ...current, password: '' }))
    } finally {
      setBusy(false)
    }
  }

  return <AuthShell title="Đăng nhập" subtitle="Truy cập không gian làm việc của bạn.">
    <Notice message={flash} success />
    <Notice message={message} />
    <form onSubmit={submit} noValidate>
      <Field name="login-email" label="Email" type="email" autoComplete="username"
        value={form.email} error={errors.email}
        onChange={(event) => setForm({ ...form, email: event.target.value })} />
      <Field name="login-password" label="Mật khẩu" type="password" autoComplete="current-password"
        value={form.password} error={errors.password}
        onChange={(event) => setForm({ ...form, password: event.target.value })} />
      <button className="button primary wide" type="submit" disabled={busy}>
        {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </button>
    </form>
    <p className="auth-switch">Chưa có tài khoản? <button type="button" className="text-button"
      onClick={() => navigate('/register')}>Đăng ký</button></p>
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
      next.password = 'Mật khẩu tối đa 72 byte.'
    if (!form.confirm) next.confirm = 'Vui lòng xác nhận mật khẩu.'
    else if (form.confirm !== form.password) next.confirm = 'Mật khẩu xác nhận không khớp.'
    if (!form.role) next.role = 'Vui lòng chọn vai trò.'
    setErrors(next)
    setMessage('')
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      await api.register({
        name: form.name.trim(), email: form.email.trim(),
        password: form.password, role: form.role,
      })
      setDone(true)
      setForm({ name: '', email: '', password: '', confirm: '', role: '' })
    } catch (error) {
      setMessage(errorMessage(error))
      if (error instanceof ApiError && Array.isArray(error.details)) {
        const fieldErrors = {}
        for (const detail of error.details) {
          if (['name', 'email', 'password', 'role'].includes(detail?.field))
            fieldErrors[detail.field] = detail.message
        }
        setErrors(fieldErrors)
      }
      setForm((current) => ({ ...current, password: '', confirm: '' }))
    } finally {
      setBusy(false)
    }
  }

  return <AuthShell title={done ? 'Đã gửi đăng ký' : 'Tạo tài khoản'}
    subtitle={done ? 'Tài khoản đang chờ quản trị viên duyệt.' : 'Đăng ký để tham gia chuỗi cung ứng.'}>
    {done ? <div className="completion">
      <div className="completion-mark" aria-hidden="true">✓</div>
      <p>Bạn sẽ đăng nhập được sau khi tài khoản được kích hoạt.</p>
      <button className="button primary wide" type="button" onClick={() => navigate('/login')}>
        Đến trang đăng nhập</button>
    </div> : <>
      <Notice message={message} />
      <form onSubmit={submit} noValidate>
        <Field name="name" label="Họ và tên" autoComplete="name" value={form.name} error={errors.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <Field name="email" label="Email" type="email" autoComplete="email"
          value={form.email} error={errors.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <Field name="password" label="Mật khẩu" type="password" autoComplete="new-password"
          value={form.password} error={errors.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })} />
        <Field name="confirm" label="Xác nhận mật khẩu" type="password" autoComplete="new-password"
          value={form.confirm} error={errors.confirm}
          onChange={(event) => setForm({ ...form, confirm: event.target.value })} />
        <Field name="role" label="Vai trò" error={errors.role}>
          <select id="role" name="role" value={form.role} aria-invalid={Boolean(errors.role)}
            aria-describedby={errors.role ? 'role-error' : undefined}
            onChange={(event) => setForm({ ...form, role: event.target.value })}>
            <option value="">Chọn vai trò</option>
            <option value="FARMER">Nhà sản xuất</option>
            <option value="PROCESSOR">Cơ sở chế biến</option>
            <option value="DISTRIBUTOR">Nhà phân phối</option>
          </select>
        </Field>
        <button className="button primary wide" type="submit" disabled={busy}>
          {busy ? 'Đang gửi đăng ký…' : 'Đăng ký'}</button>
      </form>
      <p className="auth-switch">Đã có tài khoản? <button type="button" className="text-button"
        onClick={() => navigate('/login')}>Đăng nhập</button></p>
    </>}
  </AuthShell>
}

function Workspace({ route, navigate, token, user, onLogout, onUserUpdate, preview = false }) {
  const [profile, setProfile] = useState(user)
  const [name, setName] = useState(user?.name || '')
  const [loading, setLoading] = useState(!preview)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const [nameError, setNameError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

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
    if (preview) return
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

  return <div className="workspace">
    <aside className="sidebar">
      <Brand />
      <span className="sidebar-label">Không gian làm việc</span>
      <nav aria-label="Điều hướng chính">
        <button className={`nav-link ${route === '/dashboard' ? 'active' : ''}`}
          onClick={() => navigate('/dashboard')}>Tổng quan</button>
        <button className={`nav-link ${route === '/profile' ? 'active' : ''}`}
          onClick={() => navigate('/profile')}>Hồ sơ cá nhân</button>
      </nav>
      <div className="sidebar-bottom">
        <div className="signed-in"><span className="avatar">{(profile?.name || 'U')[0]}</span>
          <span><strong>{profile?.name || 'Tài khoản'}</strong>
            <small>{ROLE_LABELS[profile?.role] || profile?.role || ''}</small></span></div>
        <button className="logout-button" type="button" onClick={() => onLogout()}>Đăng xuất</button>
      </div>
    </aside>
    <main className="workspace-main">
      <header className="mobile-header"><Brand />
        <button className="text-button" type="button" onClick={() => onLogout()}>Đăng xuất</button></header>
      <nav className="mobile-nav" aria-label="Điều hướng di động">
        <button className={route === '/dashboard' ? 'active' : ''} onClick={() => navigate('/dashboard')}>Tổng quan</button>
        <button className={route === '/profile' ? 'active' : ''} onClick={() => navigate('/profile')}>Hồ sơ</button>
      </nav>
      <div className="workspace-content">
        {preview && <div className="preview-banner" role="status">
          Bản xem trước giao diện. Dữ liệu minh họa, không kết nối API và không lưu thay đổi.
        </div>}
        {loading ? <p role="status">Đang tải thông tin tài khoản…</p> : loadError ?
          <div className="state-block" role="alert"><h1>Không thể tải dữ liệu</h1><p>{loadError}</p>
            <button className="button secondary" type="button" onClick={() => {
              setLoading(true); setRetry((value) => value + 1)
            }}>Thử lại</button></div> : route === '/profile' ? <>
            <div className="page-heading"><span className="eyebrow">TÀI KHOẢN</span>
              <h1>Hồ sơ cá nhân</h1><p>Thông tin tài khoản của bạn trong hệ thống.</p></div>
            <div className="profile-layout">
              <section className="profile-section">
                <h2>Thông tin cá nhân</h2><p>Họ tên được cập nhật sau khi lưu thành công.</p>
                <Notice message={saveError} /><Notice message={saved ? 'Đã cập nhật họ và tên.' : ''} success />
                <form onSubmit={saveName} noValidate>
                  <Field name="profile-name" label="Họ và tên" value={name} error={nameError}
                    onChange={(event) => { setName(event.target.value); setNameError(''); setSaved(false) }} />
                  <button className="button primary" type="submit"
                    disabled={preview || saving || name.trim() === profile.name}>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
                </form>
              </section>
              <section className="profile-section">
                <h2>Thông tin tài khoản</h2>
                <dl className="facts">
                  <div><dt>Email</dt><dd>{profile.email || '—'}</dd></div>
                  <div><dt>Vai trò</dt><dd>{ROLE_LABELS[profile.role] || profile.role || '—'}</dd></div>
                  <div><dt>Trạng thái</dt><dd>{profile.status === 'ACTIVE' ? 'Đang hoạt động' : profile.status || '—'}</dd></div>
                  <div><dt>Đơn vị</dt><dd>{profile.organizationName || profile.organization?.name ||
                    (profile.organizationId ? `Mã đơn vị: ${profile.organizationId}` : 'Chưa được gán')}</dd></div>
                </dl>
              </section>
            </div>
          </> : <>
            <div className="page-heading"><span className="eyebrow">TỔNG QUAN</span>
              <h1>Xin chào, {profile.name}</h1><p>Tài khoản của bạn đã sẵn sàng.</p>
              <span className="role-badge">{ROLE_LABELS[profile.role] || profile.role}</span></div>
            <div className="overview-band"><div><span className="eyebrow">TÀI KHOẢN</span>
              <h2>Thông tin cá nhân</h2><p>Xem thông tin và cập nhật họ tên của bạn.</p></div>
              <button className="button secondary" type="button" onClick={() => navigate('/profile')}>Mở hồ sơ</button></div>
          </>}
      </div>
    </main>
  </div>
}

function App() {
  const [route, setRoute] = useState(currentRoute)
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(null)
  const [flash, setFlash] = useState('')

  useEffect(() => {
    const onPop = () => setRoute(currentRoute())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((path) => {
    window.history.pushState({}, '', path)
    setRoute(path)
    setFlash('')
    window.scrollTo(0, 0)
  }, [])

  const logout = useCallback((message = '') => {
    sessionStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
    window.history.replaceState({}, '', '/login')
    setRoute('/login')
    setFlash(message)
  }, [])

  const login = useCallback((result) => {
    sessionStorage.setItem(TOKEN_KEY, result.token)
    setToken(result.token)
    setUser(result.user)
    navigate('/dashboard')
  }, [navigate])

  const protectedRoute = route === '/profile' || route === '/dashboard'
  const preview = import.meta.env.DEV && route === '/profile' &&
    new URLSearchParams(window.location.search).get('preview') === '1' && !token
  if (preview) return <Workspace route="/profile" navigate={navigate} user={PREVIEW_USER}
    onLogout={logout} onUserUpdate={setUser} preview />
  if (protectedRoute && !token) return <Login navigate={navigate} onLogin={login} flash={flash} />
  if (token && (route === '/login' || route === '/register'))
    return <Workspace route="/dashboard" navigate={navigate} token={token}
      user={user} onLogout={logout} onUserUpdate={setUser} />
  if (route === '/register') return <Register navigate={navigate} />
  if (route === '/login') return <Login navigate={navigate} onLogin={login} flash={flash} />
  return <Workspace route={route} navigate={navigate} token={token}
    user={user} onLogout={logout} onUserUpdate={setUser} />
}

export default App
