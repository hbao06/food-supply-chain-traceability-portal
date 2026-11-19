import { useState } from 'react'
import { buildTraceRoute, parseTraceInput } from '../trace/traceUtils.js'
import { IconCheckCircle, IconMapPin, IconShield } from './Icons.jsx'

export function BrandLogo({ compact = false, invert = false }) {
  return (
    <span className={`ft-brand ${invert ? 'ft-brand-invert' : ''}`}>
      <span className="ft-brand-mark" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M19.5 4.5C13.5 4.5 7 7.8 5.2 14.3C4.8 15.8 5.1 17.5 6.1 18.6C7.2 19.6 8.9 19.9 10.4 19.5C16.9 17.7 19.8 11.2 19.5 4.5Z"
            fill="currentColor"
            fillOpacity="0.22"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5.5 19L14.2 10.3"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
          <circle cx="15.5" cy="9" r="1.4" fill="#88C040" />
        </svg>
      </span>
      <span className="ft-brand-text">
        <strong>Food Trace</strong>
        {!compact && <small>Truy xuất nguồn gốc</small>}
      </span>
    </span>
  )
}

export function LeafDivider() {
  return (
    <div className="leaf-divider" aria-hidden="true">
      <span className="leaf-divider-line" />
      <svg width="46" height="18" viewBox="0 0 46 18" fill="none">
        <path
          d="M23 14C23 8.5 18.5 4 12 4C12 9.5 16.5 14 23 14Z"
          stroke="#7E9B2F"
          strokeWidth="1.5"
          fill="#91AD41"
          fillOpacity="0.18"
        />
        <path
          d="M23 14C23 8.5 27.5 4 34 4C34 9.5 29.5 14 23 14Z"
          stroke="#DF8B58"
          strokeWidth="1.5"
          fill="#DF8B58"
          fillOpacity="0.16"
        />
        <circle cx="23" cy="14" r="2" fill="#7E9B2F" />
      </svg>
      <span className="leaf-divider-line" />
    </div>
  )
}

export function PublicFooter({ navigate, preview = false }) {
  const handleQuickTrace = (batchId) => {
    navigate(buildTraceRoute('code', batchId, { preview }))
  }

  return (
    <footer id="standards" className="portal-master-footer">
      <div className="footer-top-row">
        <div className="footer-col-brand">
          <BrandLogo invert />
          <p className="footer-org-summary">
            Hệ thống truy xuất nguồn gốc chuỗi cung ứng thực phẩm Việt Nam. Xây dựng nền tảng minh bạch hóa, 
            kết nối các hợp tác xã nông sản sạch đến thị trường nội địa và quốc tế.
          </p>
          <div className="footer-cert-tags">
            <span className="cert-pill">VietGAP</span>
            <span className="cert-pill">GlobalGAP</span>
            <span className="cert-pill">HACCP</span>
            <span className="cert-pill">ISO 22000</span>
            <span className="cert-pill">SHA-256</span>
          </div>
        </div>

        <div className="footer-col-nav">
          <h4>Nhóm Nông Sản</h4>
          <ul>
            <li><button type="button" onClick={() => handleQuickTrace('FR-2026-0001')}>Cà phê Arabica Cầu Đất</button></li>
            <li><button type="button" onClick={() => handleQuickTrace('FR-2026-0201')}>Gạo ST25 Sóc Trăng</button></li>
            <li><button type="button" onClick={() => handleQuickTrace('FR-2026-0202')}>Hạt Điều Rang Muối Bình Phước</button></li>
            <li><button type="button" onClick={() => handleQuickTrace('FR-2026-0203')}>Thanh Long Ruột Đỏ Tiền Giang</button></li>
            <li><button type="button" onClick={() => handleQuickTrace('FR-2026-0204')}>Chè Ô Long Mộc Châu</button></li>
            <li><button type="button" onClick={() => handleQuickTrace('FR-2026-0002')}>Sầu Riêng Ri6 Bến Tre</button></li>
          </ul>
        </div>

        <div className="footer-col-nav">
          <h4>Dành Cho Đối Tác</h4>
          <ul>
            <li><button type="button" onClick={() => navigate('/login')}>Cổng đăng nhập đối tác</button></li>
            <li><button type="button" onClick={() => navigate('/register')}>Đăng ký gia nhập mạng lưới</button></li>
            <li><button type="button" onClick={() => navigate('/help')}>Quy chuẩn gắn tem FR-</button></li>
            <li><button type="button" onClick={() => navigate('/audit-logs')}>Bảo chứng kiểm toán chuỗi khối</button></li>
          </ul>
        </div>

        <div className="footer-col-contact">
          <h4>Đầu Mối Hỗ Trợ Kỹ Thuật</h4>
          <p><strong>Hotline:</strong> 1900 6868 (8:00 - 18:00)</p>
          <p><strong>Email:</strong> hotro@foodtrace.vn</p>
          <p><strong>Trụ sở:</strong> Tầng 8, Tòa nhà Công Nghệ Xanh, Quận 1, TP. Hồ Chí Minh</p>
        </div>
      </div>

      <div className="footer-bottom-copyright">
        <div>© 2026 Food Trace Vietnam. Bản quyền thuộc về Đề tài Chuỗi Cung Ứng Thực Phẩm Minh Bạch.</div>
        <div className="footer-legal-links">
          <span>Tiêu chuẩn TCVN 12850:2019</span>
          <span>•</span>
          <span>Bảo mật dữ liệu HMAC-SHA256</span>
        </div>
      </div>
    </footer>
  )
}

export function WorkspaceFooter() {
  return (
    <footer className="workspace-footer">
      <span>© 2026 Food Trace · Cổng quản trị chuỗi cung ứng thực phẩm</span>
      <span>Định danh chuẩn <code>FR-YYYY-NNNN</code> · Bảo toàn dữ liệu SHA-256</span>
    </footer>
  )
}
