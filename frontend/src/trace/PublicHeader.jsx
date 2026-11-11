import { IconSearch } from '../components/Icons.jsx'

export function PublicHeader({
  navigate,
  isAuthenticated = false,
  showSearchLink = false,
  preview = false,
}) {
  const homePath = preview ? '/trace?preview=1' : '/trace'

  return (
    <header className="public-header">
      <div className="public-header-inner">
        <button
          type="button"
          className="public-brand-btn"
          onClick={() => navigate(homePath)}
          aria-label="Về trang tra cứu nguồn gốc Food Trace"
        >
          <span className="brand">
            <span className="brand-mark" aria-hidden="true">FT</span>
            <span>Food Trace</span>
          </span>
          <span className="public-pill-tag">Cổng công khai</span>
        </button>

        <div className="public-header-actions">
          {showSearchLink && (
            <button
              type="button"
              className="button secondary sm with-icon"
              onClick={() => navigate(homePath)}
            >
              <IconSearch />
              <span>Tra cứu mã khác</span>
            </button>
          )}

          {isAuthenticated ? (
            <button
              type="button"
              className="public-auth-link"
              onClick={() => navigate('/batches')}
            >
              Không gian làm việc
            </button>
          ) : (
            <button
              type="button"
              className="public-auth-link"
              onClick={() => navigate('/login')}
            >
              Đăng nhập
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
