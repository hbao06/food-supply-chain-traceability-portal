# Kịch bản Demo Người Dùng — Food Supply Chain Traceability Portal

**Hệ thống:** Cổng thông tin truy xuất nguồn gốc thực phẩm và chuỗi cung ứng  
**Người phụ trách thực hiện:** Hoài Bảo — Frontend / UI-UX (W8)  
**Người review:** Lê Bá Khánh Bình  
**Phiên bản:** Hoàn thiện tuần 8 (W8-Final)  
**Ngày bàn giao:** 24/11/2026 – 30/11/2026  

---

## 1. Mục tiêu và phạm vi kịch bản demo

Kịch bản demo được xây dựng nhằm phục vụ:
1. **Kiểm tra nghiệm thu đồ án / bài tập lớn:** Giúp giảng viên, hội đồng đánh giá và người review kiểm chứng trực tiếp toàn bộ luồng nghiệp vụ chuỗi cung ứng nông sản từ nông trại đến bàn ăn.
2. **Xác minh đầy đủ các vai trò người dùng:**
   - **Người tiêu dùng (Consumer):** Tra cứu công khai qua mã lô hoặc quét QR camera, xem xuất xứ và hành trình 6 bước.
   - **Nhà sản xuất (Farmer):** Khởi tạo lô hàng nông sản (CREATED), tải mã QR chuẩn, chỉnh sửa thông tin khi chưa vận chuyển.
   - **Đơn vị vận chuyển (Distributor):** Tiếp nhận lô hàng, ghi nhận sự kiện vận chuyển (TRANSPORTED), cập nhật xe lạnh, nhiệt độ bảo quản.
   - **Cơ sở chế biến (Processor):** Tiếp nhận nguyên liệu (RECEIVED), chế biến đạt chuẩn ISO (PROCESSED), đóng gói và dán tem (PACKAGED).
   - **Nhà phân phối bán lẻ (Distributor):** Xuất kho (SHIPPED) đến các chuỗi siêu thị bán lẻ.
   - **Quản trị viên (Admin):** Giám sát toàn hệ thống, tra cứu nhật ký kiểm toán (Audit Log) bất biến và **xác thực tính toàn vẹn chuỗi băm mật mã SHA-256 (Hash Chain Verification)**.
3. **Kiểm thử các tình huống ngoại lệ & an ninh:**
   - Vi phạm thứ tự chuỗi cung ứng (`409 INVALID_SEQUENCE`).
   - Sửa đổi lô hàng đã chuyển sang khâu sau (`400 BATCH_NOT_EDITABLE`).
   - Kiểm tra mã QR giả mạo / chuỗi băm bị can thiệp.

---

## 2. Thông tin tài khoản và dữ liệu demo

Hệ thống hỗ trợ cả 2 chế độ:
- **Chế độ Preview trực tiếp (Không cần cài CSDL PostgreSQL):** Bấm nút đăng nhập nhanh 1 chạm ở trang Login hoặc truy cập `http://localhost:5173/trace?preview=1`.
- **Chế độ kết nối Backend:** Đăng nhập bằng email và mật khẩu bên dưới.

### 2.1. Danh sách tài khoản thử nghiệm

| Vai trò | Họ và tên | Email đăng nhập | Mật khẩu | Đơn vị phụ trách | Thao tác chính |
|---|---|---|---|---|---|
| **FARMER** | Nguyễn Văn An | `farmer_a@demo.local` | `Farmer@123` | HTX Cà phê Cầu Đất (Lâm Đồng) | Khởi tạo lô, xem/tải QR, sửa lô CREATED |
| **PROCESSOR** | Trần Văn Chế Biến | `processor_a@demo.local` | `Processor@123` | Nhà máy Chế biến Nông sản Sài Gòn | Ghi nhận RECEIVED, PROCESSED, PACKAGED |
| **DISTRIBUTOR** | Lê Văn Phân Phối | `distributor_a@demo.local` | `Distributor@123` | Vận tải Lạnh Miền Nam (TP.HCM) | Ghi nhận TRANSPORTED, xuất kho SHIPPED |
| **ADMIN** | Quản trị viên Demo | `admin_1@demo.local` | `Admin@123` | Ban Quản trị Hệ thống | Tra cứu Audit Log, xác thực chuỗi băm |
| **CONSUMER** | Khách vãng lai | *(Không cần tài khoản)* | *(Không cần)* | Toàn xã hội | Quét QR / nhập mã tại `/trace` |

---

### 2.2. Danh sách lô hàng mẫu (Seed Data)

| Mã lô | Tên sản phẩm | Xuất xứ nông trại | Sản lượng | Trạng thái hiện tại | Ý nghĩa kịch bản |
|---|---|---|---|---|---|
| **BATCH-2026-0001** | Cà phê Arabica Cầu Đất Thượng Hạng | Xã Trạm Hành, TP. Đà Lạt, Lâm Đồng | 1.250,5 kg | `CREATED` | Dùng demo Farmer chỉnh sửa hoặc Distributor tiếp nhận |
| **BATCH-2026-0002** | Gạo ST25 Hữu Cơ Sóc Trăng | Huyện Mỹ Xuyên, Tỉnh Sóc Trăng | 5.000 kg | `TRANSPORTED` | Dùng demo Processor tiếp nhận nguyên liệu |
| **BATCH-2026-0003** | Chè Ô Long Mộc Châu Thượng Phẩm | Nông trường Mộc Châu, Sơn La | 350,25 kg | `RECEIVED` | Dùng demo Processor thực hiện khâu chế biến |
| **BATCH-2026-0004** | Hạt Điều Rang Muối Bình Phước | Huyện Bù Đăng, Tỉnh Bình Phước | 820 kg | `PROCESSED` | Dùng demo khâu đóng gói thành phẩm |
| **BATCH-2026-0005** | Thanh Long Ruột Đỏ Chợ Gạo (VietGAP) | Huyện Chợ Gạo, Tiền Giang | 3.200 kg | `PACKAGED` | Dùng demo Distributor xuất kho ra thị trường |
| **BATCH-2026-0006** | Bưởi Da Xanh Bến Tre Loại 1 | Huyện Châu Thành, Tỉnh Bến Tre | 1.800 kg | `SHIPPED` | **Hoàn chỉnh 6 bước!** Dùng demo Consumer quét QR xem ngay |

---

## 3. Các kịch bản demo chi tiết từng bước

### Kịch bản 1: Người tiêu dùng tra cứu nguồn gốc nông sản (Không cần tài khoản)
- **Mục đích:** Chứng minh tính minh bạch, người dân dùng điện thoại quét mã QR hoặc gõ mã lô để xem xuất xứ và chuỗi cung ứng.
- **Các bước thực hiện:**
  1. Truy cập trang chủ `/trace` (hoặc bấm nút *"Tra cứu nguồn gốc công khai"* tại trang Đăng nhập).
  2. **Cách A - Nhập mã lô:** Gõ `BATCH-2026-0006` vào ô tìm kiếm -> Nhấn nút **"Tra cứu thông tin"**.
  3. **Cách B - Quét mã QR:** Bấm chuyển sang tab *"Quét mã QR"* -> Bật Camera hoặc tải ảnh chụp mã QR -> Hệ thống tự động giải mã và điều hướng tới kết quả.
  4. **Quan sát kết quả (UI-02):**
     - Thẻ huy hiệu trạng thái: `ĐÃ XUẤT KHO (SHIPPED)` màu xanh ngọc.
     - Tên sản phẩm: `Bưởi Da Xanh Bến Tre Loại 1`, xuất xứ `Huyện Châu Thành, Tỉnh Bến Tre`.
     - Thanh tiến trình chuỗi cung ứng: Đạt 100% (6/6 giai đoạn hoàn thành).
     - Dòng thời gian (Timeline): Hiển thị đầy đủ 6 mốc:
       1. Khởi tạo nông trại (Nông trại Cái Mơn)
       2. Vận chuyển thùng kín (Xe 71C-082.45)
       3. Tiếp nhận tại trạm sơ chế
       4. Xử lý làm sạch, rửa vỏ, bọc màng xốp
       5. Đóng thùng dán tem chuẩn GS1
       6. Xuất kho giao hệ thống Co.opmart / WinMart.
     - **Tính bảo mật:** Không hiển thị các trường nội bộ của doanh nghiệp (số lượng, giá tiền, ID nhân viên), chỉ hiển thị thông tin công khai an toàn.

---

### Kịch bản 2: Nhà sản xuất (Farmer) tạo lô hàng và in mã QR
- **Mục đích:** Nông dân thu hoạch nông sản sạch và đưa vào hệ thống quản lý.
- **Các bước thực hiện:**
  1. Truy cập `/login` -> Bấm chip đăng nhập nhanh **"Nông dân (Farmer)"** (hoặc đăng nhập bằng `farmer_a@demo.local`).
  2. Quan sát **Dashboard Nông dân**:
     - Các thẻ KPI: Tổng số lô (6), Chờ vận chuyển (1), Hoàn tất xuất bán (1), Chứng nhận 100% VietGAP.
     - Thao tác nhanh: Nút *"Khởi tạo lô mới"*.
  3. Bấm **"Khởi tạo lô mới"** -> Mở form `UI-08`:
     - Nhập Tên sản phẩm: `Xoài Cát Hòa Lộc Tiền Giang Xuất Khẩu`.
     - Nhập Nơi xuất xứ: `Xã Hòa Hưng, Huyện Cái Bè, Tiền Giang`.
     - Nhập Sản lượng: `2500` kg.
     - Bấm **"Xác nhận tạo lô"**.
  4. Hệ thống tự động cấp mã lô chuẩn ISO: `BATCH-2026-XXXX`, tạo mã QR kèm chữ ký HMAC, và tạo mốc `CREATED` đầu tiên.
  5. Chuyển sang màn hình **Chi tiết lô**:
     - Bấm nút **"Mã QR"** -> Mở modal xem mã QR độ phân giải cao -> Thử nút **"Tải ảnh QR (PNG)"** và **"Sao chép liên kết"**.
     - Bấm **"Hiệu chỉnh lô"** (vì lô vẫn ở trạng thái `CREATED`) -> Sửa sản lượng từ `2500` thành `2600` kg -> Bấm Lưu -> Thông báo cập nhật thành công và ghi nhận Audit log.

---

### Kịch bản 3: Đơn vị vận chuyển (Distributor) tiếp nhận và ghi nhận luân chuyển
- **Mục đích:** Ghi nhận sự kiện vận chuyển hàng hóa từ nông trường về kho trung chuyển.
- **Các bước thực hiện:**
  1. Đăng xuất hoặc chuyển sang tài khoản **"Phân phối (Distributor)"** (`distributor_a@demo.local`).
  2. Mở danh sách lô hàng -> Chọn lô **`BATCH-2026-0001`** (Cà phê Arabica Cầu Đất, hiện đang `CREATED`).
  3. Bấm nút **"Ghi nhận sự kiện mới"** -> Mở Modal `UI-11`:
     - Hệ thống tự động phát hiện bước kế tiếp bắt buộc là: **`VẬN CHUYỂN (TRANSPORTED)`** (các bước khác bị khóa để chống nhảy cóc).
     - Đơn vị thực hiện: Tự điền `Vận tải Lạnh Miền Nam`.
     - Thời gian: Giữ mặc định thời điểm hiện tại.
     - Địa điểm: Chọn gợi ý nhanh `Trạm Logistics Cầu Đất, Lâm Đồng`.
     - Ghi chú: `Xe tải lạnh số hiệu 49C-129.55, nhiệt độ thùng hàng duy trì ổn định 5°C`.
     - **Lưu ý bảo mật (P-05):** Form hiển thị thông báo rõ ràng *"Nội dung công khai: Địa điểm và mô tả này sẽ hiển thị trên Cổng tra cứu cho Người tiêu dùng"*.
  4. Bấm **"Xác nhận ghi nhận sự kiện"** -> Trạng thái lô hàng đổi sang `TRANSPORTED`, timeline cập nhật tức thì.

---

### Kịch bản 4: Cơ sở chế biến (Processor) tiếp nhận nguyên liệu & chế biến
- **Mục đích:** Nhà máy sơ chế kiểm định đạt chuẩn ISO 22000 và dán tem đóng gói.
- **Các bước thực hiện:**
  1. Đổi sang tài khoản **"Chế biến (Processor)"** (`processor_a@demo.local`).
  2. Vào lô **`BATCH-2026-0002`** (hiện đang `TRANSPORTED`):
     - Bấm *"Ghi nhận sự kiện mới"* -> Chọn bước tuần tự kế tiếp: **`TIẾP NHẬN (RECEIVED)`**.
     - Nhập địa điểm: `Kho tiếp nhận nguyên liệu Tân Tạo, TP.HCM`.
     - Bấm Xác nhận.
  3. Tiếp tục bấm *"Ghi nhận sự kiện mới"* trên chính lô đó:
     - Bước kế tiếp: **`CHẾ BIẾN (PROCESSED)`**.
     - Địa điểm: `Dây chuyền sấy lạnh tiệt trùng ISO 22000`.
     - Ghi chú: `Độ ẩm đạt 12.5%, không phát hiện tồn dư thuốc BVTV`.
     - Bấm Xác nhận.
  4. Tiếp tục ghi nhận bước kế tiếp: **`ĐÓNG GÓI (PACKAGED)`**:
     - Nhập địa điểm: `Phòng dán nhãn & mã QR chống giả`.
     - Bấm Xác nhận -> Lô hàng sẵn sàng cho nhà phân phối xuất bán.

---

### Kịch bản 5: Quản trị viên (Admin) tra cứu Audit Log & Kiểm tra chuỗi băm
- **Mục đích:** Ban quản trị giám sát an toàn dữ liệu, chống giả mạo CSDL bằng thuật toán mật mã học.
- **Các bước thực hiện:**
  1. Đăng nhập bằng tài khoản **"Quản trị viên (Admin)"** (`admin_1@demo.local`).
  2. Nhận thấy thanh điều hướng có thêm mục **"Nhật ký kiểm toán"** (Chỉ Admin mới có quyền).
  3. Bấm vào **"Nhật ký kiểm toán"** (Route `/audit-logs`):
     - Xem bảng danh sách toàn bộ các thao tác `CREATE`, `EVENT`, `UPDATE` có gắn kèm mã băm SHA-256.
     - Lọc thử nghiệm theo Hành động (`CREATE` / `EVENT`) hoặc gõ tìm kiếm mã lô `BATCH-2026-0001`.
     - Sao chép thử mã SHA-256 của một bản ghi bất kỳ.
  4. **Thao tác then chốt — Bấm nút "Xác thực chuỗi băm mật mã":**
     - Hệ thống hiển thị hiệu ứng tính toán băm SHA-256 tuần tự từ bản ghi đầu tiên đến bản ghi mới nhất.
     - Kết quả hiển thị thẻ xác nhận màu xanh lá nổi bật:
       * **`CHUỖI BĂM HỢP LỆ 100%`**
       * Thuật toán: `HMAC-SHA256`
       * Thông điệp: *"Toàn bộ chuỗi băm kiểm toán (Audit Logs) và sự kiện chuỗi cung ứng đều khớp tuyệt đối. Không phát hiện bất kỳ sự can thiệp hoặc thay đổi dữ liệu trái phép nào."*

---

### Kịch bản 6: Kiểm thử các trường hợp ngoại lệ & vi phạm quy tắc
- **Test Case 1 (Nhảy cóc sai thứ tự chuỗi):**
  - Vào một lô đang `CREATED`, cố tình gọi API gửi sự kiện `PACKAGED` hoặc `SHIPPED`.
  - Kết quả: Hệ thống chặn ngay ở giao diện (các nút bước sau bị disabled có tooltip giải thích) và backend trả về `409 INVALID_SEQUENCE`.
- **Test Case 2 (Sửa lô hàng đã luân chuyển):**
  - Vào lô `BATCH-2026-0002` (đang `TRANSPORTED`), nút *"Hiệu chỉnh lô"* tự động ẩn. Nếu cố tình truy cập `/batches/102/edit`, giao diện thông báo `Lô đã chuyển sang trạng thái tiếp theo trong chuỗi cung ứng, không thể chỉnh sửa` và chặn thao tác.
- **Test Case 3 (Mã QR giả mạo / Không tìm thấy):**
  - Truy cập `/trace` và nhập mã không tồn tại: `BATCH-9999-9999`.
  - Kết quả: Hiển thị giao diện thông báo lỗi thân thiện `Không tìm thấy thông tin truy xuất hợp lệ. Vui lòng kiểm tra lại mã trên tem nhãn sản phẩm.` kèm gợi ý tra cứu các mã mẫu hợp lệ.

---

## 4. Hướng dẫn khởi chạy và kiểm tra nhanh

```bash
# 1. Khởi chạy ứng dụng Frontend
cd frontend
npm run dev

# 2. Mở trình duyệt truy cập:
# - Cổng người tiêu dùng: http://localhost:5173/trace
# - Cổng người dùng nội bộ: http://localhost:5173/login

# 3. Chạy toàn bộ 23 bài kiểm thử tự động của Frontend:
npm test
```
