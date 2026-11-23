import { BrandLogo } from '../components/BrandAndFooter.jsx'
import { IconQr, IconSearch } from '../components/Icons.jsx'

export function PublicHeader({
  navigate,
  isAuthenticated = false,
  showSearchLink = false,
  onSelectScanTab,
}) {
  const homePath = '/trace'

  function goToSection(hash) {
    if (window.location.pathname !== '/' && window.location.pathname !== '/trace') {
      navigate(homePath)
      setTimeout(() => {
        const el = document.querySelector(hash)
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      }, 120)
      return
    }
    const el = document.querySelector(hash)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <header className="public-header-bar">
      <div className="header-container">
        <div
          className="header-brand"
          onClick={() => navigate(homePath)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate(homePath)}
        >
          <BrandLogo invert subtitle="Cổng Truy Xuất Nguồn Gốc Nông Sản" />
        </div>

        <nav className="header-nav-menu" aria-label="Menu chính">
          <button
            type="button"
            className="header-nav-link"
            onClick={() => navigate(homePath)}
          >
            Trang chủ
          </button>
          <button
            type="button"
            className="header-nav-link"
            onClick={() => goToSection('#showcase')}
          >
            Nông sản
          </button>
          <button
            type="button"
            className="header-nav-link"
            onClick={() => goToSection('#pillars')}
          >
            Quy trình
          </button>
          <button
            type="button"
            className="header-nav-link"
            onClick={() => goToSection('#standards')}
          >
            Tiêu chuẩn
          </button>
          <button
            type="button"
            className="header-nav-link text-btn"
            onClick={() => {
              if (onSelectScanTab) onSelectScanTab()
              else navigate(homePath)
            }}
          >
            <IconQr /> Quét QR
          </button>
        </nav>

        <div className="header-actions">
          {showSearchLink && (
            <button
              type="button"
              className="btn-portal-login with-icon"
              onClick={() => navigate(homePath)}
            >
              <IconSearch /> Tra cứu mã khác
            </button>
          )}

          {isAuthenticated ? (
            <button
              type="button"
              className="btn-portal-workspace"
              onClick={() => navigate('/dashboard')}
            >
              Không gian làm việc →
            </button>
          ) : (
            <button
              type="button"
              className="btn-portal-login"
              onClick={() => navigate('/login')}
            >
              Đăng nhập đối tác
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
