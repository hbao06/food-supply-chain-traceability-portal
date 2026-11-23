'use strict';

// Trợ lý AI dành riêng cho Food Trace (công khai, KHÔNG đọc dữ liệu nội bộ).
// - Luôn có bộ tri thức nội bộ (trả lời về hệ thống, quy trình, QR, vai trò, tra cứu mã lô FR-).
// - Nếu đặt GEMINI_API_KEY thì dùng Gemini để diễn đạt tự nhiên hơn, vẫn chỉ dựa trên tri thức + dữ liệu công khai.
const STATUS_LABEL = {
  CREATED: 'Mới khởi tạo', TRANSPORTED: 'Đang vận chuyển', RECEIVED: 'Đã tiếp nhận',
  PROCESSED: 'Đã chế biến', PACKAGED: 'Đã đóng gói', SHIPPED: 'Đã xuất kho',
};
const CODE_RE = /FR-\d{4}-\d{4,}/i;
const MAX_MESSAGE = 500;

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

const SUGGESTIONS = [
  'Cách quét mã QR để xem nguồn gốc?',
  'Quy trình 6 giai đoạn gồm những bước nào?',
  'Mã lô FR- có định dạng thế nào?',
  'Cách kiểm tra chuỗi băm SHA-256?',
];

const KNOWLEDGE = [
  { keys: ['qr', 'quet', 'camera'],
    reply: 'Để xem nguồn gốc: mở trang chủ Food Trace, chọn "Quét / Tải ảnh mã QR" rồi đưa tem vào camera hoặc tải ảnh QR lên. Bạn cũng có thể dùng camera điện thoại quét thẳng tem, hệ thống mở trang hành trình của lô. Không cần đăng nhập.' },
  { keys: ['dinh dang', 'ma lo', 'fr-', 'ma so'],
    reply: 'Mã lô có dạng FR-YYYY-NNNN (ví dụ FR-2026-0002): FR là tiền tố định danh, YYYY là năm tạo, NNNN là số thứ tự tăng dần. Mã được hệ thống tự cấp khi nông trại tạo lô và được in kèm tem QR có chữ ký HMAC chống giả mạo.' },
  { keys: ['quy trinh', '6 buoc', '6 giai doan', 'giai doan', 'chuoi cung ung'],
    reply: 'Một lô đi qua 6 giai đoạn theo đúng thứ tự: 1) Khởi tạo (Nông trại) → 2) Vận chuyển (Phân phối) → 3) Tiếp nhận (Phân phối) → 4) Chế biến (Chế biến) → 5) Đóng gói (Chế biến) → 6) Xuất kho (Phân phối). Mỗi bước chỉ đúng vai trò mới ghi được, không sửa hoặc xóa sau khi ghi.' },
  { keys: ['tao lo', 'khoi tao', 'them lo', 'lo moi'],
    reply: 'Tài khoản Nông trại (Farmer): vào Quản lý lô hàng → "Khởi tạo lô mới", nhập tên sản phẩm, vùng canh tác, sản lượng (kg). Hệ thống tự cấp mã FR-, sinh tem QR và ghi sự kiện CREATED. Lô chỉ sửa được khi còn ở trạng thái Mới khởi tạo.' },
  { keys: ['ghi nhan', 'su kien', 'van chuyen', 'tiep nhan', 'che bien', 'dong goi', 'xuat kho'],
    reply: 'Đơn vị Phân phối ghi: Vận chuyển, Tiếp nhận, Xuất kho. Đơn vị Chế biến ghi: Chế biến, Đóng gói. Mở "Quản lý lô hàng" → tab "Chờ tiếp nhận" → vào chi tiết lô → "Ghi nhận sự kiện". Địa điểm và mô tả sẽ hiển thị công khai cho người tiêu dùng.' },
  { keys: ['dang ky', 'tai khoan', 'duyet', 'dang nhap', 'mat khau'],
    reply: 'Đăng ký tại trang Đăng ký (chọn vai trò Nông trại / Chế biến / Phân phối). Tài khoản mới ở trạng thái chờ duyệt; Quản trị viên gán đơn vị rồi duyệt thì bạn mới đăng nhập được. Mật khẩu cần tối thiểu 8 ký tự gồm cả chữ và số.' },
  { keys: ['kiem toan', 'audit', 'sha', 'bam', 'toan ven', 'bat bien'],
    reply: 'Mọi thay đổi đều ghi nhật ký kiểm toán chỉ-thêm-mới, liên kết bằng chuỗi băm SHA-256. Quản trị viên vào "Kiểm toán SHA-256" → "Xác thực chuỗi băm" để kiểm tra có bản ghi nào bị sửa trái phép hay không.' },
  { keys: ['vai tro', 'quyen', 'admin', 'farmer', 'processor', 'distributor'],
    reply: 'Hệ thống có 4 vai trò: Quản trị viên (duyệt tài khoản, quản lý đơn vị, kiểm toán), Nông trại (tạo/sửa lô), Chế biến (chế biến, đóng gói), Phân phối (vận chuyển, tiếp nhận, xuất kho). Người tiêu dùng chỉ tra cứu công khai, không cần tài khoản.' },
  { keys: ['san pham', 'nong san', 'ca phe', 'gao', 'hat dieu', 'thanh long', 'tra', 'che', 'sau rieng'],
    reply: 'Hệ thống hỗ trợ truy xuất nguồn gốc nhiều mặt hàng nông sản Việt Nam như cà phê, lúa gạo, hạt điều, trái cây tươi và chè. Bạn có thể nhập mã lô theo chuẩn FR-YYYY-NNNN (ví dụ FR-2026-0001) hoặc quét tem QR trên bao bì để xem toàn bộ hành trình.' },
  { keys: ['xin chao', 'chao', 'hello', 'hi ', 'alo'],
    reply: 'Xin chào! Mình là trợ lý Food Trace. Mình có thể giúp bạn tra cứu mã lô FR-, hướng dẫn quét QR, giải thích quy trình chuỗi cung ứng và cách dùng hệ thống.' },
  { keys: ['cam on', 'thanks'], reply: 'Rất vui được giúp bạn! Cần tra cứu thêm lô nào cứ nhắn mình nhé.' },
];

function formatTrace(t) {
  const events = Array.isArray(t.events) ? t.events : [];
  const last = events[events.length - 1];
  const lines = [
    `Lô ${t.batchCode}: ${t.productName}`,
    `Nguồn gốc: ${t.origin}${t.organizationName ? ` · ${t.organizationName}` : ''}`,
    `Trạng thái: ${STATUS_LABEL[t.currentStatus] || t.currentStatus} (${events.length}/6 bước).`,
  ];
  if (last) lines.push(`Mốc mới nhất: ${STATUS_LABEL[last.eventType] || last.eventType} tại ${last.location}.`);
  return lines.join('\n');
}

function knowledgeReply(message) {
  const n = ` ${norm(message)} `;
  for (const item of KNOWLEDGE) if (item.keys.some((k) => n.includes(k))) return item.reply;
  return 'Mình chưa hiểu rõ câu hỏi. Bạn có thể hỏi về: quét QR, định dạng mã lô FR-, quy trình 6 giai đoạn, cách tạo lô, ghi nhận sự kiện, đăng ký tài khoản hoặc nhập mã lô (ví dụ FR-2026-0001) để mình tra cứu.';
}

function createAssistantService({ traceService, env = process.env, fetchImpl = globalThis.fetch }) {
  async function lookup(message) {
    const m = CODE_RE.exec(message);
    if (!m) return { code: null, trace: null };
    const code = m[0].toUpperCase();
    try { return { code, trace: await traceService.byCode(code) }; } catch (_) { return { code, trace: null }; }
  }

  async function askGemini(message, context) {
    const key = env.GEMINI_API_KEY;
    if (!key || typeof fetchImpl !== 'function') return null;
    const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
    const system = 'Bạn là trợ lý của cổng truy xuất nguồn gốc thực phẩm Food Trace. Trả lời ngắn gọn, thân thiện bằng tiếng Việt, ' +
      'chỉ dựa trên thông tin dưới đây. Không bịa dữ liệu, không tiết lộ thông tin nội bộ. Nếu ngoài phạm vi, hãy nói bạn chỉ hỗ trợ về Food Trace.\n\n' +
      `Tri thức hệ thống:\n${KNOWLEDGE.map((k) => `- ${k.reply}`).join('\n')}\n\n${context ? `Dữ liệu công khai của lô được hỏi:\n${context}` : ''}`;
    try {
      const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: message }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim();
      return text || null;
    } catch (_) { return null; }
  }

  async function chat(rawMessage) {
    const message = String(rawMessage || '').trim().slice(0, MAX_MESSAGE);
    const { code, trace } = await lookup(message);
    const context = trace ? formatTrace(trace) : '';
    const ai = await askGemini(message, context);
    if (ai) return { reply: ai, source: 'gemini', suggestions: SUGGESTIONS.slice(0, 3), batchCode: trace ? trace.batchCode : null };
    if (trace) return { reply: formatTrace(trace), source: 'knowledge', suggestions: ['Cách quét mã QR để xem nguồn gốc?', 'Quy trình 6 giai đoạn gồm những bước nào?'], batchCode: trace.batchCode };
    if (code) return { reply: `Mình không tìm thấy lô ${code}. Hãy kiểm tra lại mã trên tem (định dạng FR-YYYY-NNNN), ví dụ FR-2026-0001.`, source: 'knowledge', suggestions: SUGGESTIONS.slice(0, 3), batchCode: null };
    return { reply: knowledgeReply(message), source: 'knowledge', suggestions: SUGGESTIONS, batchCode: null };
  }

  return { chat };
}

module.exports = { createAssistantService, knowledgeReply, formatTrace, SUGGESTIONS };
