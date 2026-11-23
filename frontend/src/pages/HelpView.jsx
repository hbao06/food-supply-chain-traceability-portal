import { useState } from 'react'
import { ROLE_LABELS_VI } from '../batches/batchConstants.js'
import {
  IconSeedling,
  IconTruck,
  IconIndustry,
  IconShield,
  IconSparkles,
  IconQr,
  IconCheck
} from '../components/Icons.jsx'

const STANDARD_STEPS = [
  {
    step: '01',
    role: 'FARMER',
    name: 'Khởi tạo & Canh tác',
    desc: 'Hợp tác xã/Nông dân khai báo giống, nhật ký bón phân sinh học, vùng trồng VietGAP và cấp mã định danh FR-.'
  },
  {
    step: '02',
    role: 'DISTRIBUTOR',
    name: 'Vận chuyển thu gom',
    desc: 'Đơn vị phân phối tiếp nhận hàng, ghi nhận tuyến đường vận chuyển và điều kiện bảo quản trong nhật ký lô.'
  },
  {
    step: '03',
    role: 'DISTRIBUTOR',
    name: 'Tiếp nhận tại kho',
    desc: 'Kho trung tâm kiểm tra độ ẩm, ngoại quan sản phẩm, xác nhận nhập kho và bảo quản lạnh chuẩn ISO 22000.'
  },
  {
    step: '04',
    role: 'PROCESSOR',
    name: 'Sơ chế & Chế biến',
    desc: 'Nhà máy phân loại, rang sấy, đóng gói bao bì hút chân không theo quy chuẩn an toàn thực phẩm HACCP.'
  },
  {
    step: '05',
    role: 'PROCESSOR',
    name: 'Đóng gói & Tem QR',
    desc: 'In và dán tem mã QR có chữ ký số HMAC lên từng túi/thùng hàng trước khi xuất xưởng.'
  },
  {
    step: '06',
    role: 'DISTRIBUTOR',
    name: 'Phân phối thị trường',
    desc: 'Vận chuyển đến các siêu thị, cửa hàng nông sản sạch. Người tiêu dùng quét tem để xem toàn bộ chứng thư.'
  }
]

const ROLE_GUIDES = [
  {
    role: 'Nông trại',
    icon: <IconSeedling />,
    color: '#73932A',
    actions: [
      'Vào menu "Quản lý lô hàng" → Bấm nút "Khởi tạo lô mới".',
      'Chọn sản phẩm, nhập vùng canh tác (VD: Đà Lạt, Sóc Trăng) và sản lượng thu hoạch.',
      'Hệ thống tự động cấp mã chuẩn FR-YYYY-NNNN và tem QR truy xuất.',
      'Lô hàng chỉ được chỉnh sửa thông tin khi còn ở trạng thái "Mới khởi tạo".'
    ]
  },
  {
    role: 'Vận chuyển & Phân phối',
    icon: <IconTruck />,
    color: '#2B6CB0',
    actions: [
      'Xem danh sách lô "Chờ tiếp nhận" trong khu vực được phân công.',
      'Mở chi tiết lô hàng → Bấm "Ghi nhận sự kiện" để xác nhận vận chuyển hoặc nhập kho.',
      'Nhập biển số xe lạnh, hành trình, nhiệt độ bảo quản và địa chỉ kho tiếp nhận.',
      'Mọi thông tin địa điểm và thời gian được mã hóa lưu vết vĩnh viễn.'
    ]
  },
  {
    role: 'Cơ sở chế biến',
    icon: <IconIndustry />,
    color: '#C05621',
    actions: [
      'Tiếp nhận lô hàng thô từ kho nông sản đã được chuyển đến.',
      'Ghi nhận sự kiện "Chế biến" (sấy lạnh, rang xay, đóng túi chân không).',
      'Ghi nhận sự kiện "Đóng gói", kiểm định chứng nhận ISO 22000/HACCP.',
      'Xuất bản tem nhãn QR thành phẩm để chuẩn bị phân phối ra thị trường.'
    ]
  },
  {
    role: 'Quản trị viên',
    icon: <IconShield />,
    color: '#4A5568',
    actions: [
      'Duyệt và kích hoạt tài khoản đối tác mới gia nhập chuỗi.',
      'Gán phân quyền đơn vị (HTX Nông trại, Xưởng chế biến, Công ty vận tải).',
      'Tra soát kiểm toán chuỗi băm mật mã SHA-256.',
      'Khóa tài khoản vi phạm hoặc có dấu hiệu gian lận thương mại.'
    ]
  }
]

const FAQ_ITEMS = [
  {
    q: 'Mã lô chuẩn FR-YYYY-NNNN có cấu trúc và quy tắc như thế nào?',
    a: 'Mã lô bắt đầu bằng tiền tố FR- (Food Traceability), tiếp theo là năm sản xuất (VD: 2026), và 4 chữ số tự tăng (VD: 0001, 0201). Mã này là khóa định danh duy nhất toàn hệ thống, do máy chủ tự sinh và không được phép trùng lặp.'
  },
  {
    q: 'Người tiêu dùng quét tem QR có cần phải tải ứng dụng hay đăng nhập không?',
    a: 'Hoàn toàn không. Người tiêu dùng chỉ cần dùng camera điện thoại (iOS, Android, Zalo) quét trực tiếp tem QR. Trình duyệt sẽ mở ngay trang kết quả xác thực công khai hiển thị nguồn gốc nông trại, chứng chỉ VietGAP và nhiệt độ vận chuyển.'
  },
  {
    q: 'Tại sao các sự kiện trong chuỗi cung ứng không cho phép sửa hay xóa?',
    a: 'Hệ thống áp dụng nguyên tắc nhật ký chỉ-ghi (append-only ledger). Mỗi sự kiện ghi nhận được gắn chặt với sự kiện trước đó qua mã băm SHA-256 (Hash-chaining). Mọi hành vi sửa đổi sẽ làm gãy chuỗi băm và bị phát hiện ngay lập tức trong mục Kiểm toán.'
  },
  {
    q: 'Tem QR trên bao bì có bị làm giả hoặc sao chép được không?',
    a: 'Mỗi tem QR chứa một chữ ký số mật mã HMAC-SHA256 kết hợp giữa mã lô và khóa bí mật của hệ thống. Nếu kẻ gian tự in tem giả hoặc sửa mã lô trên đường link, hệ thống quét sẽ báo lỗi "Tem không hợp lệ hoặc đã bị can thiệp".'
  },
  {
    q: 'Làm thế nào để xuất dữ liệu báo cáo phục vụ thanh tra và kiểm toán chất lượng?',
    a: 'Đối tác và Quản trị viên chỉ cần vào menu "Báo cáo & Thống kê", chọn khoảng thời gian cần tra soát (7 ngày, 30 ngày, quý) và bấm nút "Xuất báo cáo CSV". File tải về định dạng chuẩn Excel hiển thị đầy đủ tiếng Việt.'
  }
]

export function HelpView() {
  const [activeTab, setActiveTab] = useState('standards') // 'standards' | 'roles' | 'faq'
  const [openFaqIndex, setOpenFaqIndex] = useState(0)

  const handleOpenAiChat = () => {
    window.dispatchEvent(new Event('ft-open-chat'))
  }

  return (
    <div className="help-page-container">
      {/* 1. HEADER CHUYÊN TRANG HƯỚNG DẪN */}
      <div className="page-heading-row">
        <div>
          <h1 className="page-main-heading">Hướng dẫn quy chuẩn &amp; Thao tác hệ thống</h1>
          <p className="page-sub-desc">
            Quy chuẩn kỹ thuật truy xuất nguồn gốc nông sản tham chiếu TCVN 12850:2019 và bảo mật chuỗi băm SHA-256.
          </p>
        </div>
        <button
          type="button"
          className="button primary with-icon"
          onClick={handleOpenAiChat}
        >
          <IconSparkles /> Hỏi trợ lý AI chuỗi cung ứng
        </button>
      </div>

      {/* 2. THANH ĐIỀU HƯỚNG CHUYÊN MỤC */}
      <div className="help-tabs-bar">
        <button
          type="button"
          className={`help-tab-btn ${activeTab === 'standards' ? 'active' : ''}`}
          onClick={() => setActiveTab('standards')}
        >
          <IconCheck /> Quy chuẩn 6 bước &amp; Mã FR-
        </button>
        <button
          type="button"
          className={`help-tab-btn ${activeTab === 'roles' ? 'active' : ''}`}
          onClick={() => setActiveTab('roles')}
        >
          <IconShield /> Hướng dẫn theo vai trò
        </button>
        <button
          type="button"
          className={`help-tab-btn ${activeTab === 'faq' ? 'active' : ''}`}
          onClick={() => setActiveTab('faq')}
        >
          <IconQr /> Câu hỏi thường gặp (FAQ)
        </button>
      </div>

      {/* 3. NỘI DUNG THEO TAB */}
      {activeTab === 'standards' && (
        <div className="help-tab-content">
          {/* Box giải thích mã FR- */}
          <section className="guide-highlight-card">
            <div className="guide-card-icon-box">
              <IconQr />
            </div>
            <div>
              <h2 className="guide-card-title">Cấu trúc mã định danh số chuẩn: <code>FR-YYYY-NNNN</code></h2>
              <p className="guide-card-text">
                Mỗi lô nông sản khi thu hoạch được cấp một mã duy nhất: <strong>FR-</strong> (Mã định danh lô Food Record), 
                <strong>2026</strong> (Năm thu hoạch/khởi tạo) và <strong>0001..9999</strong> (Mã số lô thứ tự). 
                Mã này được khắc trên tem QR và gắn liền với chuỗi nhật ký mật mã không thể thay đổi.
              </p>
            </div>
          </section>

          {/* Sơ đồ 6 giai đoạn chuỗi */}
          <div className="standards-steps-grid">
            {STANDARD_STEPS.map((step) => (
              <div key={step.step} className="step-guide-card">
                <div className="step-card-num-badge">{step.step}</div>
                <h3 className="step-card-heading">{step.name}</h3>
                <span className="step-card-role-tag">{ROLE_LABELS_VI[step.role] || step.role}</span>
                <p className="step-card-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="help-tab-content">
          <div className="role-guides-grid">
            {ROLE_GUIDES.map((rg) => (
              <div key={rg.role} className="role-guide-box">
                <div className="role-box-head">
                  <span className="role-icon-wrap" style={{ color: rg.color }}>
                    {rg.icon}
                  </span>
                  <h3 className="role-box-title">{rg.role}</h3>
                </div>
                <ul className="role-actions-list">
                  {rg.actions.map((act, i) => (
                    <li key={i}>{act}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'faq' && (
        <div className="help-tab-content">
          <div className="faq-accordion-container">
            {FAQ_ITEMS.map((item, idx) => (
              <div
                key={idx}
                className={`faq-item-row ${openFaqIndex === idx ? 'expanded' : ''}`}
                onClick={() => setOpenFaqIndex(openFaqIndex === idx ? -1 : idx)}
              >
                <div className="faq-question-bar">
                  <h3 className="faq-question-title">{item.q}</h3>
                  <span className="faq-toggle-arrow">
                    {openFaqIndex === idx ? '▲' : '▼'}
                  </span>
                </div>
                {openFaqIndex === idx && (
                  <div className="faq-answer-pane">
                    <p>{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
