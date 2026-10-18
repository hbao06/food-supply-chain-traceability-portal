# Software Requirements Specification (SRS) – v1.4

**Dự án:** Food Supply Chain Traceability & Provenance Portal (Course 502045)
**Phiên bản:** 1.4 (Tuần 2) | **Nhóm 13** | **Người tổng hợp:** TV4 (Lê Bá Khánh Bình) | **Người review:** TV3
**Trạng thái:** Bản nháp v1 – các mục đánh dấu ⚠️ cần đối chiếu/cập nhật sau khi cả nhóm chốt.

---

## 1. Giới thiệu
### 1.1 Mục đích
Tài liệu mô tả yêu cầu chức năng và phi chức năng của hệ thống truy xuất nguồn gốc thực phẩm, làm cơ sở cho thiết kế (UML, ERD, OpenAPI), lập trình và kiểm thử.

### 1.2 Phạm vi
Hệ thống cho phép các bên trong chuỗi cung ứng quản lý **lô sản phẩm**, ghi nhận **sự kiện chuỗi cung ứng**, xem **timeline** hành trình, sinh **mã QR** và cho người tiêu dùng **truy xuất công khai** không cần đăng nhập. Hệ thống có xác thực JWT, phân quyền RBAC và audit log.

### 1.3 Định nghĩa và viết tắt
| Thuật ngữ | Ý nghĩa |
|---|---|
| Lô (Batch) | Một đợt sản phẩm có mã định danh riêng |
| Sự kiện chuỗi cung ứng (Event) | Bước trong hành trình: thu hoạch, đóng gói, vận chuyển, phân phối, bán lẻ… |
| Timeline | Danh sách sự kiện của một lô theo thứ tự thời gian |
| Trace token | Chuỗi ngẫu nhiên định danh công khai của lô, nằm trong URL của mã QR |
| RBAC | Phân quyền theo vai trò |
| US / AC / FR / NFR | User Story / Acceptance Criteria / Functional / Non-Functional Requirement |

### 1.4 Tài liệu tham chiếu
- `README.md`, `CONTRIBUTING.md`
- `docs/SRS/acceptance-criteria-guide.md` (chuẩn viết AC)
- `docs/SRS/user-stories-tv4.md`, tài liệu User Story của TV1 và `docs/SRS/user-stories-batch.md` (TV2, PR #25); User Story của TV3 (chờ)
- `docs/openapi-spec.yaml`, `docs/ERD`, `docs/UML` (Tuần 3 hoàn thiện)

## 2. Mô tả tổng quan
### 2.1 Vai trò người dùng
| Vai trò | Mô tả | Đăng nhập |
|---|---|---|
| Nhà sản xuất (Farmer) | Tạo lô, ghi sự kiện thu hoạch | Có |
| Nhà chế biến (Processor) | Ghi sự kiện chế biến, đóng gói | Có |
| Nhà phân phối (Distributor) | Ghi sự kiện vận chuyển, phân phối | Có |
| Nhà bán lẻ (Retailer) | Ghi sự kiện nhận hàng, bán lẻ | Có |
| Quản trị viên (Admin) | Quản lý đơn vị, tài khoản, xem audit log | Có |
| Người tiêu dùng | Quét QR, xem truy xuất công khai | Không |

⚠️ Đối chiếu danh sách vai trò với ma trận quyền của TV3.

### 2.2 Môi trường vận hành
Ứng dụng web (frontend + backend REST API + cơ sở dữ liệu), đóng gói bằng Docker. ⚠️ Công nghệ cụ thể theo bảng công nghệ trong README.

### 2.3 Ràng buộc và giả định
- Thời gian thực hiện 8 tuần, nhóm 4 thành viên.
- API tuân theo OpenAPI 3.1.
- Độ phủ kiểm thử tự động tối thiểu 60%.
- Người tiêu dùng chỉ được xem các trường dữ liệu được đánh dấu công khai.

## 3. Yêu cầu chức năng
### 3.1 Danh mục User Story theo nhóm
| Nhóm | Phụ trách | Mã User Story | Trạng thái |
|---|---|---|---|
| Giao diện / tài khoản | TV1 (Trương Huỳnh Hoài Bảo) | US-UI01 đăng ký; US-UI02 đăng nhập; US-UI03 hồ sơ; US-UI04 dashboard; US-UI05 tra cứu bằng mã lô; US-UI06 xem kết quả truy xuất; US-UI07 đăng xuất | Đã bàn giao 7 story, chờ TV4 review; ⚠️ chưa tạo Issue |
| Nghiệp vụ lô | TV2 (Chung Nguyễn Minh Trí) | US-B01 tạo lô; US-B02 cập nhật lô; US-B03 tìm kiếm và lọc; US-B04 xem chi tiết; US-B05 xem timeline | PR #25 đã được TV1 approve; ⚠️ chưa tạo Issue |
| Bảo mật / dữ liệu | TV3 | US-SEC-01 phân quyền; 02 quản lý đơn vị; 03 audit log; 04 khóa tài khoản | ⚠️ TV3 xác nhận |
| QR / QA / DevOps | TV4 | US-QR-01, US-QR-02, US-QR-03, US-QA-01, US-DEPLOY-01 | Hoàn thành (file `user-stories-tv4.md`) |

> US-UI05/US-UI06 (TV1) quy định hành vi giao diện tra cứu và hiển thị kết quả; US-QR-03 (TV4) quy định hành vi quét QR và dữ liệu được phép công khai ở phía hệ thống. Hai bên bổ trợ nhau; thông báo lỗi và tên token cần thống nhất (xem mục 10).
> ⚠️ Định dạng mã User Story hiện chưa thống nhất: TV1 dùng `US-UI01`, TV4 dùng `US-QR-01`. Cần chốt một định dạng trước khi tạo Issue.

### 3.2 Yêu cầu chức năng phần QR / QA / DevOps (TV4)
| Mã | Yêu cầu | Từ User Story | Ưu tiên |
|---|---|---|---|
| FR-QR-01 | Mỗi lô có đúng một mã QR, sinh tự động trong cùng Database Transaction với việc tạo lô (FR-BATCH-01); QR chứa URL `https://<domain>/trace/<qr_token>`, trong đó `qr_token` có chữ ký HMAC tạo bằng khóa bí mật của server | US-QR-01 | Must |
| FR-QR-02 | `qr_token` không đổi khi cập nhật lô; nếu sinh QR lỗi (ví dụ thiếu khóa HMAC) thì rollback toàn bộ việc tạo lô và trả 500; khóa bí mật không được đưa vào repo | US-QR-01 | Must |
| FR-QR-03 | Cho phép xem dữ liệu QR và tải QR dạng PNG (≥ 512x512 px) hoặc SVG, tên file `QR-<mã lô>.<đuôi>` | US-QR-02 | Must |
| FR-QR-04 | Xem/tải QR theo quy tắc truy cập lô: ngoài phạm vi hoặc không tồn tại trả 404, chưa đăng nhập trả 401, định dạng không hỗ trợ trả 400 | US-QR-02 | Must |
| FR-QR-05 | Truy xuất công khai không cần đăng nhập qua `GET /trace/{qrToken}` và `GET /trace/code/{batchCode}`, hiển thị thông tin sản phẩm và timeline (kể cả lô mới chỉ có sự kiện `CREATED`) | US-QR-03 | Must |
| FR-QR-06 | Chỉ trả các trường được phép công khai; không trả email, mã người dùng, mã người thực hiện, audit log | US-QR-03 | Must |
| FR-QR-07 | `qr_token` không tồn tại hoặc sai chữ ký, và mã lô không tồn tại, đều trả 404 với cùng thông báo "Không tìm thấy thông tin truy xuất hợp lệ", không tiết lộ lý do | US-QR-03 | Must |
| FR-QR-08 | Giới hạn tần suất cho các endpoint truy xuất công khai (60 yêu cầu/phút/IP, vượt thì 429) | US-QR-03 | Should |
| FR-QA-01 | CI tự chạy lint và test trên mỗi PR vào `main` | US-QA-01 | Must |
| FR-QA-02 | CI báo đỏ và chặn merge khi test thất bại hoặc coverage dưới 60% (từ Tuần 4) | US-QA-01 | Must |
| FR-DEP-01 | Chạy toàn bộ hệ thống bằng `docker compose up --build` | US-DEPLOY-01 | Should |
| FR-DEP-02 | Backend dừng với thông báo rõ khi thiếu biến môi trường bắt buộc | US-DEPLOY-01 | Should |

⚠️ Mục 3.5 (yêu cầu bảo mật và dữ liệu của TV3) vẫn chờ tài liệu User Story của TV3.

### 3.3 Yêu cầu giao diện / tài khoản (TV1)
Nguồn: tài liệu "User Story giao diện và tài khoản – W2-Hoài Bảo" (7 story). Các yêu cầu dưới đây mô tả hành vi giao diện; chưa khẳng định endpoint đã được lập trình.

| Mã | Yêu cầu | Từ User Story | Ưu tiên |
|---|---|---|---|
| FR-UI-01 | Đăng ký bằng họ tên, email, mật khẩu (theo chính sách), xác nhận mật khẩu và vai trò Farmer/Processor/Distributor; thành công thì thông báo "chờ duyệt", không tự mở dashboard | US-UI01 | Must |
| FR-UI-02 | Kiểm tra dữ liệu đăng ký ở giao diện (trường bắt buộc, định dạng email, xác nhận mật khẩu) và hiển thị lỗi từ API (kể cả email đã dùng) | US-UI01 | Must |
| FR-UI-03 | Không cho chọn vai trò Admin hoặc tự gán đơn vị khi đăng ký; backend kiểm tra quyền độc lập | US-UI01 | Must |
| FR-UI-04 | Đăng nhập bằng email và mật khẩu; thành công thì chuyển đến dashboard theo vai trò do hệ thống trả về | US-UI02 | Must |
| FR-UI-05 | Sai thông tin đăng nhập chỉ hiển thị thông báo chung, không tiết lộ tài khoản có tồn tại | US-UI02 | Must |
| FR-UI-06 | Tài khoản PENDING hoặc LOCKED bị từ chối với thông báo tương ứng, không tạo phiên | US-UI02 | Must |
| FR-UI-07 | Xem hồ sơ của chính mình (họ tên, email, vai trò, đơn vị); không hiển thị mật khẩu hay giá trị băm | US-UI03 | Must |
| FR-UI-08 | Cập nhật tên hiển thị; thành công thì hiển thị tên mới và thông báo | US-UI03 | Should |
| FR-UI-09 | Đổi mật khẩu bằng mật khẩu hiện tại, mật khẩu mới và xác nhận; chỉ báo thành công khi API xác nhận, xóa nội dung các ô sau khi thành công | US-UI03 | Should |
| FR-UI-10 | Email, vai trò, trạng thái, đơn vị ở chế độ chỉ xem trên trang hồ sơ | US-UI03 | Must |
| FR-UI-11 | Dashboard hiển thị tên người dùng, liên kết hồ sơ, đăng xuất và danh sách lô trong phạm vi API cho phép; thao tác theo vai trò (Farmer tạo lô, Processor/Distributor xử lý lô, Admin quản trị) | US-UI04 | Must |
| FR-UI-12 | Phân biệt "chưa có lô" với "lỗi tải dữ liệu"; lỗi tải có thao tác Thử lại | US-UI04 | Must |
| FR-UI-13 | Ẩn menu ngoài quyền; truy cập trực tiếp trang ngoài quyền không hiển thị dữ liệu được bảo vệ | US-UI04 | Must |
| FR-UI-14 | Tra cứu công khai bằng mã lô không cần đăng nhập: cắt khoảng trắng đầu/cuối, mã trống thì không gửi yêu cầu | US-UI05 | Must |
| FR-UI-15 | Mã không tìm thấy thì thông báo và cho nhập lại; mất kết nối thì giữ mã đã nhập, cho Thử lại, không kết luận mã không tồn tại | US-UI05 | Must |
| FR-UI-16 | Trang kết quả hiển thị mã lô, tên sản phẩm, xuất xứ, đơn vị và timeline từ cũ đến mới (loại, thời điểm, địa điểm, mô tả công khai) lấy từ endpoint truy xuất công khai | US-UI06 | Must |
| FR-UI-17 | Kết quả công khai không hiển thị email, mã người dùng, mã người thực hiện, audit log; hiển thị tốt trên màn hình 360 px, không cuộn ngang toàn trang | US-UI06 | Must |
| FR-UI-18 | QR/mã không hợp lệ thì hiển thị một thông báo thống nhất và liên kết về trang nhập mã lô; lỗi tải thì có Thử lại và không hiển thị dữ liệu mẫu như kết quả thật | US-UI06 | Must |
| FR-UI-19 | Đăng xuất xóa thông tin xác thực và dữ liệu nội bộ của phiên ở frontend, đưa về trang đăng nhập | US-UI07 | Must |
| FR-UI-20 | Sau đăng xuất, nút Quay lại, tải lại hoặc mở trực tiếp trang nội bộ đều yêu cầu đăng nhập, không hiển thị dữ liệu từ cache cũ | US-UI07 | Must |
| FR-UI-21 | Quy tắc chung: hiển thị trạng thái đang xử lý và chặn gửi lặp; lỗi nhập đặt gần trường; phiên hết hạn ở trang nội bộ thì xóa phiên và về đăng nhập (trang công khai không yêu cầu đăng nhập); biểu mẫu có nhãn và thao tác được bằng bàn phím | Mục 4 tài liệu TV1 | Should |
### 3.4 Yêu cầu nghiệp vụ lô và timeline (TV2)
Nguồn: `docs/SRS/user-stories-batch.md` (PR #25, 5 story US-B01..B05). Trạng thái lô theo báo cáo tiến độ: `CREATED`, `TRANSPORTED`, `RECEIVED`, `PROCESSED`, `PACKAGED`, `SHIPPED`.

| Mã | Yêu cầu | Từ User Story | Ưu tiên |
|---|---|---|---|
| FR-BATCH-01 | Farmer tạo lô với tên sản phẩm, nguồn gốc, số lượng > 0. Trong **một Database Transaction**: tạo Batch (`batch_id` tự tăng, `batch_code` duy nhất), sinh mã QR có chữ ký HMAC (`qr_token`), ghi sự kiện `CREATED`; trả 201 kèm chi tiết lô, dữ liệu QR và sự kiện | US-B01 | Must |
| FR-BATCH-02 | Dữ liệu không hợp lệ (thiếu tên, số lượng ≤ 0) thì trả 400 và rollback toàn bộ transaction, không để lại Batch, QR hoặc sự kiện nào | US-B01 | Must |
| FR-BATCH-03 | Chỉ Farmer được tạo lô: sai vai trò trả 403, chưa đăng nhập hoặc token hết hạn trả 401 | US-B01 | Must |
| FR-BATCH-04 | Farmer cập nhật thông tin lô chỉ khi lô thuộc đơn vị của mình **và** đang ở trạng thái `CREATED`; thành công trả 200 và ghi `AUDIT_LOG` | US-B02 | Must |
| FR-BATCH-05 | Lô đã chuyển khỏi `CREATED` thì từ chối cập nhật, thông báo chỉ được sửa lô ở trạng thái `CREATED` (mã lỗi 400 hay 409: xem mục 10) | US-B02 | Must |
| FR-BATCH-06 | Lô ngoài phạm vi sở hữu hoặc không tồn tại thì trả 404 và giữ nguyên dữ liệu | US-B02 | Must |
| FR-BATCH-07 | Danh sách lô có lọc theo `status` và tìm theo tên sản phẩm, mã lô; không có lô khớp thì trả danh sách rỗng | US-B03 | Must |
| FR-BATCH-08 | Phạm vi danh sách: Farmer, Distributor, Processor chỉ thấy lô thuộc `organization_id` của mình hoặc lô đơn vị mình đã tiếp nhận/xử lý; Admin thấy toàn bộ | US-B03 | Must |
| FR-BATCH-09 | `status` không hợp lệ thì trả 400 kèm các giá trị hợp lệ; chưa đăng nhập hoặc token hết hạn thì trả 401 | US-B03 | Must |
| FR-BATCH-10 | Xem chi tiết lô (sản phẩm, nguồn gốc, số lượng, trạng thái hiện tại, người tạo) chỉ trong phạm vi đơn vị hoặc là Admin | US-B04 | Must |
| FR-BATCH-11 | Xem timeline: thông tin tổng quan lô và danh sách sự kiện theo thời gian tăng dần (cũ đến mới); lô mới tạo có đúng một sự kiện `CREATED` | US-B05 | Must |
| FR-BATCH-12 | Quy tắc truy cập chung cho lô và timeline: ngoài phạm vi hoặc không tồn tại thì trả 404 (không lộ sự tồn tại của lô); chưa đăng nhập hoặc token hết hạn thì trả 401; sai vai trò thì trả 403 | US-B01..B05 | Must |

> Timeline công khai cho Consumer không thuộc nhóm này: xử lý ở endpoint `GET /trace/{qrToken}` (US-QR-03 của TV4, giao diện US-UI05/UI06 của TV1).

✅ FR-QR-01 và FR-QR-02 (mục 3.2) đã được sửa theo FR-BATCH-01: QR sinh tự động cùng lô, `qr_token` có chữ ký HMAC.
### 3.5 Yêu cầu bảo mật và dữ liệu (TV3) ⚠️ chờ tổng hợp

## 4. Yêu cầu phi chức năng
| Mã | Loại | Yêu cầu | Cách kiểm chứng |
|---|---|---|---|
| NFR-01 | Hiệu năng | Trang truy xuất công khai tải xong dưới 3 giây (mạng 4G thông thường) | Đo thủ công / công cụ trình duyệt |
| NFR-02 | Bảo mật | Mật khẩu băm; API bảo vệ bằng JWT trừ endpoint truy xuất công khai | Test API (Tuần 4) |
| NFR-03 | Bảo mật | `qr_token` có chữ ký HMAC, không đoán được và không giả mạo được; khóa bí mật chỉ nằm trong cấu hình server, không commit vào repo | Review thiết kế, test token bị sửa |
| NFR-04 | Bảo mật | Giới hạn tần suất truy xuất công khai | Test API |
| NFR-05 | Kiểm thử | Độ phủ kiểm thử tự động tối thiểu 60% | Báo cáo coverage trong CI |
| NFR-06 | Khả dụng | Các màn hình trong phạm vi dùng được trên điện thoại rộng 360 px, không cuộn ngang toàn trang (người tiêu dùng quét QR bằng điện thoại) | Kiểm thử trên thiết bị / công cụ trình duyệt |
| NFR-07 | Triển khai | Dựng được môi trường bằng Docker Compose | Chạy thử trên máy sạch |
| NFR-08 | Truy vết | Mọi thay đổi dữ liệu quan trọng được ghi audit log | Kiểm tra log |
| NFR-09 | Bảo trì | Mọi thay đổi đi qua PR có review và CI xanh | Branch protection |
| NFR-10 | Bảo mật | Chính sách mật khẩu (độ dài tối thiểu, độ phức tạp) ⚠️ chưa chốt, TV3 đề xuất | Test API / review |

## 5. Giao diện bên ngoài
- **Giao diện người dùng:** theo `docs/ui-screen-list.md` và `docs/wireframes`.
- **API:** REST, mô tả bởi `docs/openapi-spec.yaml` (OpenAPI 3.1).
- **Endpoint QR / truy xuất (theo bản nháp API; riêng endpoint xem/tải QR là đề xuất ⚠️ cần đối chiếu OpenAPI):**

| Method | Path | Mô tả | Quyền |
|---|---|---|---|
| POST | `/batches` (US-B01) | Tạo lô, đồng thời sinh QR và sự kiện `CREATED` trong một transaction | Farmer |
| GET | `/batches/{batchId}/qr?format=png\|svg` (đề xuất ⚠️) | Xem dữ liệu QR hoặc tải ảnh QR | Người có quyền đọc lô |
| GET | `/trace/{qrToken}` | Truy xuất công khai qua QR | Không cần đăng nhập |
| GET | `/trace/code/{batchCode}` | Truy xuất công khai qua mã lô | Không cần đăng nhập |

## 6. Mô hình dữ liệu
Xem `docs/ERD`. Thực thể liên quan QR: Batch, QRCode (batch_id, qr_token, created_at); bản ghi QRCode được tạo trong cùng transaction với Batch và sự kiện `CREATED` (FR-BATCH-01). ⚠️ TV3 xác nhận khi hoàn thiện ERD.

## 7. Tiêu chí chấp nhận
Mỗi User Story có Acceptance Criteria theo Given-When-Then, tối thiểu một kịch bản thành công (S) và một kịch bản lỗi (E), đặt mã `AC-<US>-S/E<n>`. Chuẩn viết ở `acceptance-criteria-guide.md`.

## 8. Ma trận truy vết (phần TV4)
| User Story | Yêu cầu chức năng | Kiểm thử dự kiến (viết ở Tuần 3 trong `test-plan.md`) |
|---|---|---|
| US-QR-01 | FR-QR-01, FR-QR-02, NFR-03 | TC-QR-01..04 (QR sinh cùng lô, qr_token không đổi sau cập nhật, rollback khi lỗi, token bị sửa) |
| US-QR-02 | FR-QR-03, FR-QR-04 | TC-QR-05..10 (xem, PNG, SVG, ngoài phạm vi 404, chưa đăng nhập 401, định dạng sai 400) |
| US-QR-03 | FR-QR-05..08, NFR-01, NFR-04 | TC-QR-11..18 (qua QR, qua mã lô, lô mới, ẩn dữ liệu nội bộ, token sai, mã lô sai, rate limit) |
| US-QA-01 | FR-QA-01, FR-QA-02, NFR-05 | Kiểm tra thủ công PR xanh/đỏ |
| US-DEPLOY-01 | FR-DEP-01, FR-DEP-02, NFR-07 | Chạy thử `docker compose up` trên máy sạch |

## 9. Lịch sử phiên bản
| Phiên bản | Tuần | Nội dung | Người thực hiện |
|---|---|---|---|
| 1.0 | 2 | Khung SRS, yêu cầu phần TV4, danh mục User Story | TV4 |
| 1.1 | 2 | Bổ sung yêu cầu giao diện/tài khoản (TV1, FR-UI-01..21), danh mục điểm cần thống nhất | TV4 |
| 1.2 | 2 | Bổ sung yêu cầu nghiệp vụ lô (TV2, FR-BATCH-01..12), cập nhật và bổ sung điểm cần thống nhất | TV4 |
| 1.3 | 2 | Sửa phần TV4 theo US-B01 và US-UI06: QR sinh cùng lô có HMAC, xem/tải QR theo quyền đọc lô, truy xuất công khai qua QR và mã lô; cập nhật FR-QR, NFR-03, endpoint, ma trận truy vết | TV4 |
| 1.4 | 2 | Thêm mục 11 (đề xuất chờ xác nhận P1..P9) và phiếu xác nhận `confirmation-requests-w2.md` | TV4 |

## 10. Điểm cần thống nhất (tổng hợp từ các User Story)
| # | Nội dung | Bên liên quan | Ghi chú |
|---|---|---|---|
| 1 | Chính sách mật khẩu cụ thể | TV3, TV1 | Các AC của TV1 đang tham chiếu "chính sách đã thống nhất" nên chưa kiểm thử được |
| 2 | Luồng đăng ký, trạng thái PENDING, cách Admin duyệt và gán đơn vị | TV3, TV2, TV1 | Chưa có trong OpenAPI |
| 3 | Quy tắc phạm vi lô (theo người tạo hay theo đơn vị) | TV2, TV3 | Đề xuất của TV2: theo đơn vị (`organization_id`), Admin xem tất cả; cần TV3 xác nhận với ma trận quyền |
| 4 | Mã lỗi khi truy cập ngoài phạm vi (403 hay 404) | TV2, TV3 | Đề xuất của TV2: 404 (ngoài phạm vi hoặc không tồn tại), 403 (sai vai trò), 401 (chưa đăng nhập); cần TV3 xác nhận |
| 5 | Token của QR: dùng `qr_token` có chữ ký HMAC (US-B01, US-UI06) | TV4, TV2, TV1 | ✅ TV4 đã sửa US-QR-01, FR-QR-01..02; chờ TV2/TV1 xác nhận cấu trúc token và tên biến khóa bí mật |
| 6 | Thông báo lỗi truy xuất dùng chung "Không tìm thấy thông tin truy xuất hợp lệ"; cách giao diện hiển thị lỗi 429 | TV4, TV1 | ✅ US-QR-03 đã dùng chung câu chữ; ⚠️ US-UI06 vẫn cần bổ sung xử lý 429 |
| 7 | Tra cứu công khai bằng mã lô (`/trace/code/{batchCode}`) áp dụng cùng giới hạn tần suất, ẩn trường nội bộ và thông báo 404 như đường QR | TV4, TV2 | ✅ Đã đưa vào US-QR-03 (S2, S4, E2, E3); chờ TV2 xác nhận |
| 8 | Email đã được sử dụng: báo rõ (US-UI01) hay thông báo chung để tránh dò tài khoản (nguyên tắc ở US-UI02) | TV3, TV1 | Cần một quyết định bảo mật nhất quán |
| 9 | Đăng xuất: có endpoint thu hồi JWT không; "xóa cache phiên" gồm những nơi lưu nào | TV3, TV1 | US-UI07 hiện chỉ cam kết phần frontend |
| 10 | Tên trạng thái lô và loại sự kiện (ERD khác bản nháp endpoint) | TV3, TV2 | TV2 dùng 6 trạng thái theo báo cáo tiến độ; chốt cùng ERD/UML/OpenAPI ở Tuần 3 |
| 11 | Định dạng mã User Story và Acceptance Criteria (`US-UI01`/`AC01` hay `US-QR-01`/`AC-QR-01-S1`) | Cả nhóm | Chốt trước khi tạo Issue |
| 12 | US-B03 cho Distributor/Processor thấy cả lô "đã tiếp nhận/xử lý", nhưng US-B04/B05 chỉ nói lô "thuộc đơn vị" | TV2 | Có thể thấy lô trong danh sách nhưng bị 404 khi xem chi tiết hoặc timeline; cần một định nghĩa phạm vi đọc duy nhất |
| 13 | US-B02 còn ghi "400 hoặc 409" (lô đã đổi trạng thái) và "404 hoặc 403" (ngoài phạm vi) | TV2, TV3 | Chốt 409 và 404 cho nhất quán với quy ước đầu tài liệu |
| 14 | Vai trò Retailer có ở mục 2.1 nhưng không có trong story đăng ký (TV1) và US-B03 (TV2) | TV3, TV1, TV2 | Giữ hay bỏ Retailer |
| 15 | US-B01 sinh QR tự động cùng lô; US-QR-01 từng mô tả tạo QR theo yêu cầu | TV4, TV2 | ✅ Đã sửa: US-QR-01 là QR sinh cùng lô có HMAC, US-QR-02 là xem/tải QR; không còn endpoint tạo QR riêng |
| 16 | Ghi chú cuối `user-stories-batch.md` gọi endpoint công khai là "US-B04 của TV4"; story của TV4 là US-QR-03 | TV2 | Sửa ghi chú |

## 11. Đề xuất chờ xác nhận (do TV4 soạn)
Nội dung gửi từng người nằm ở `docs/SRS/confirmation-requests-w2.md`. Khi người nhận đồng ý, cập nhật mục 10 và đổi cột "Trạng thái" bên dưới.

| Mã | Đề xuất | Người xác nhận | Liên quan mục 10 | Trạng thái |
|---|---|---|---|---|
| P1 | `qr_token = <batch_code>.<signature>`; `signature = base64url(HMAC-SHA256(QR_HMAC_SECRET, batch_code))`; xác minh bằng so sánh hằng thời gian; không hết hạn | TV2 | 5 | ⚠️ Chờ |
| P2 | Biến môi trường `QR_HMAC_SECRET` khai báo trong `backend/.env.example` (giá trị mẫu, không dùng thật) | TV2 | 5 | ⚠️ Chờ |
| P3 | `GET /batches/{batchId}/qr` trả JSON `{batchCode, qrToken, traceUrl}`; kèm `?format=png\|svg` thì trả ảnh | TV2 | 5 | ⚠️ Chờ |
| P4 | Vượt giới hạn truy xuất công khai trả 429 kèm header `Retry-After`; giao diện hiển thị "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút" | TV2, TV1 | 6, 7 | ⚠️ Chờ |
| P5 | Mật khẩu tối thiểu 8 ký tự, có cả chữ và số | TV3 | 1 | ⚠️ Chờ |
| P6 | Email trùng khi đăng ký: báo "Email đã được sử dụng" kèm giới hạn tần suất; đăng nhập giữ thông báo chung | TV3, TV1 | 8 | ⚠️ Chờ |
| P7 | JWT sống ngắn (ví dụ 1 giờ), không thu hồi phía server trong phạm vi đồ án; US-UI07 chỉ xóa phiên ở frontend | TV3, TV1 | 9 | ⚠️ Chờ |
| P8 | Giữ nguyên mã User Story và định dạng Acceptance Criteria gốc của từng tác giả; SRS ghi mã gốc | Cả nhóm | 11 | ⚠️ Chờ |
| P9 | Retailer: bỏ khỏi phạm vi nếu ma trận quyền của TV3 không có; nếu giữ thì bổ sung vào US-UI01 và US-B03 | TV3, TV1, TV2 | 14 | ⚠️ Chờ |
