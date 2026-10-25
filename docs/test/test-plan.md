# Test Plan – Food Supply Chain Traceability & Provenance Portal

| Thông tin | Nội dung |
|---|---|
| Phiên bản | 1.0 (Tuần 3) |
| Nhóm | Nhóm 13 |
| Người lập | TV4 (Lê Bá Khánh Bình), QA / DevOps / QR |
| Người review | TV3 |
| Trạng thái | Bản nháp v1. Các mục đánh dấu ⚠️ chờ xác nhận, xem mục 11 |

---

## 1. Giới thiệu

### 1.1 Mục đích
Tài liệu xác định chiến lược, phạm vi, môi trường, ca kiểm thử, tiêu chí đạt và lịch kiểm thử cho đồ án, đồng thời có **ma trận truy vết** từ User Story và Acceptance Criteria (AC) đến yêu cầu chức năng (FR) và ca kiểm thử (TC). Mục tiêu theo kế hoạch đồ án: kiểm thử tự động với độ phủ (coverage) từ 60%, chỉ merge khi review được duyệt và CI thành công.

### 1.2 Phạm vi
**Trong phạm vi:** tài khoản và hồ sơ (đăng ký, đăng nhập, hồ sơ, đăng xuất), phân quyền RBAC, quản lý lô, sự kiện chuỗi cung ứng và timeline, mã QR (sinh, xem, tải), truy xuất công khai, CI/CD bằng GitHub Actions, chạy hệ thống bằng Docker.
**Ngoài phạm vi:** kiểm thử tải quy mô lớn, kiểm thử xâm nhập chuyên sâu, kiểm thử trên trình duyệt cũ và nhiều thiết bị thật.

### 1.3 Tài liệu tham chiếu
- `docs/SRS/SRS-v1.md` (yêu cầu FR, NFR, mục 10 và 11 điểm chờ xác nhận)
- `docs/SRS/user-stories-tv4.md`, `docs/SRS/user-stories-batch.md`, tài liệu User Story giao diện của TV1
- `docs/UML/sequence-diagrams.md` (SD-01 tạo lô, SD-02 quét QR, SD-03 xem/tải QR)
- `docs/openapi-spec.yaml`, `docs/ERD`
- Tài liệu "Kiểm thử tĩnh và kiểm thử động" của nhóm

---

## 2. Chiến lược kiểm thử

### 2.1 Kiểm thử tĩnh (không chạy chương trình)
| Hoạt động | Công cụ / cách làm | Khi nào |
|---|---|---|
| Review chéo qua Pull Request | Checklist PR; TV1 review TV2, TV2 review TV3, TV3 review TV4, TV4 review TV1 | Mọi PR |
| Phân tích mã tĩnh | ESLint, SonarLint trên IDE | Mọi PR |
| Chặn lộ bí mật | ggshield (pre-commit), kiểm tra `.env` trong `.gitignore` | Mọi commit |
| Quét thư viện và image | `npm audit`, Trivy cho Docker image | Tuần 4 và Tuần 7 |
| Rà soát tài liệu | Checklist Given-When-Then cho SRS, User Story; lint OpenAPI | Tuần 2 đến 3 |
| Fagan Inspection rút gọn | Auth/RBAC, `qr_token` HMAC, chuyển trạng thái lô, endpoint truy xuất công khai | Tuần 4 đến 7 |

### 2.2 Kiểm thử động (chạy chương trình)
| Mức | Mục tiêu | Công cụ đề xuất | Người viết chính |
|---|---|---|---|
| Unit | Hàm thuần: ký/xác minh HMAC, chuyển trạng thái, chuẩn hóa mã lô | Jest | Người sở hữu module, TV4 hỗ trợ |
| API / Integration | Endpoint, mã lỗi, phân quyền, transaction, rollback | Jest + Supertest, DB thử | TV4 chủ trì |
| Giao diện / E2E | Luồng đăng nhập, tạo lô, tải QR, quét QR, xem timeline | Vitest + React Testing Library; Playwright hoặc Cypress | TV4, TV1 |
| Phi chức năng (nhẹ) | Truy xuất công khai dưới 3 giây (NFR-01); giới hạn 60 yêu cầu/phút/IP (NFR-04) | k6 hoặc autocannon | TV4 |
| CI/CD, Docker | CI chặn merge đúng; `docker compose up` chạy được | GitHub Actions, Docker | TV4 |

Công cụ ở bảng trên là **đề xuất**, nhóm có thể thay bằng công cụ tương đương.

### 2.3 Nguyên tắc
1. Mỗi Acceptance Criteria có ít nhất một ca kiểm thử; kịch bản lỗi (E) và phân quyền là bắt buộc.
2. Ca kiểm thử mô tả theo Given-When-Then, kết quả mong đợi đo được (mã HTTP, thông báo, trạng thái dữ liệu, ngưỡng số).
3. Truy cập ngoài phạm vi hoặc lô không tồn tại luôn kiểm tra là **404**, sai vai trò **403**, chưa đăng nhập hoặc token hết hạn **401**.
4. Dữ liệu và khóa dùng cho kiểm thử là dữ liệu thử riêng, không dùng khóa thật.

---

## 3. Môi trường và dữ liệu kiểm thử

| Môi trường | Mô tả |
|---|---|
| Local | `docker compose up --build` (frontend, backend, database); file `.env` tạo từ `.env.example` |
| CI | GitHub Actions, `ubuntu-latest`, Node 20, cơ sở dữ liệu thử dạng container, biến môi trường thử (`JWT_SECRET`, `QR_HMAC_SECRET` giá trị giả) |

**Dữ liệu mẫu (seed cho kiểm thử):**
| Mã | Mô tả |
|---|---|
| `farmer_a`, `farmer_b` | Farmer thuộc đơn vị A và đơn vị B (đã ACTIVE) |
| `processor_a`, `distributor_a` | Processor và Distributor của đơn vị A |
| `admin_1` | Quản trị viên |
| `user_pending`, `user_locked` | Tài khoản ở trạng thái PENDING và LOCKED |
| `BATCH-001` | Lô đơn vị A, trạng thái `CREATED`, có QR |
| `BATCH-002` | Lô đơn vị A đã chuyển khỏi `CREATED` |
| `BATCH-B01` | Lô của đơn vị B (dùng kiểm tra ngoài phạm vi) |

⚠️ Seed do TV3 cung cấp (`database/`), TV4 thống nhất tên mã khi viết test.

---

## 4. Tiêu chí vào, ra và Quality Gate

**Tiêu chí vào mỗi đợt kiểm thử:** AC đã được review; OpenAPI có request, response và mã lỗi chính của chức năng; môi trường chạy được; dữ liệu mẫu sẵn sàng.

**Quality Gate khi merge PR:**
| Điều kiện | Ngưỡng |
|---|---|
| CI (lint và test) | Xanh |
| Review | Ít nhất 1 Approve |
| Coverage toàn dự án | Từ 60% (áp dụng từ Tuần 4, đo chính thức Tuần 8) |
| Coverage module lõi (auth, HMAC, chuyển trạng thái) | Mục tiêu 80% |
| Lỗi bảo mật Critical (SQLi, secret bị ghi cứng) | 0 |
| ggshield | Đạt |

**Tiêu chí ra (Tuần 8):** mọi TC mức Must đã chạy và đạt; không còn lỗi mức Critical hoặc High đang mở; coverage từ 60%; E2E luồng tạo lô đến quét QR đạt trên CI; có báo cáo kiểm thử và hướng dẫn chạy Docker.

---

## 5. Danh mục ca kiểm thử

**Chú thích:** Loại = API, UI (E2E), CI, Docker, Unit, Perf. Ưu tiên = M (Must), S (Should). Ca có ⚠️ phụ thuộc điểm chờ xác nhận ở mục 11.

### 5.1 QR và truy xuất công khai (TV4)
| Mã | Ca kiểm thử (Given / When) | Kết quả mong đợi | AC | Loại | Ưu tiên |
|---|---|---|---|---|---|
| TC-QR-01 | Farmer đăng nhập tạo lô hợp lệ | 201; lô có đúng 1 QR; `qr_token` có chữ ký HMAC; URL `/trace/<qr_token>`; phản hồi kèm dữ liệu QR | AC-QR-01-S1 | API | M |
| TC-QR-02 | Lô `BATCH-001` có `qr_token` T; Farmer cập nhật thông tin lô | `qr_token` vẫn là T | AC-QR-01-S2 | API | M |
| TC-QR-03 | Thiếu khóa `QR_HMAC_SECRET` khi tạo lô | 500; không có Batch, QR, sự kiện `CREATED` (rollback) | AC-QR-01-E1 | API + DB | M |
| TC-QR-04 | Sửa 1 ký tự của `qr_token` rồi mở `/trace/<token đã sửa>` | 404, cùng thông báo như token không tồn tại | AC-QR-01-E2 | API | M |
| TC-QR-05 | Người dùng có quyền đọc `BATCH-001` gọi `GET /batches/{id}/qr` không `format` ⚠️ | 200 kèm URL truy xuất của lô | AC-QR-02-S1 | API | M |
| TC-QR-06 | Như trên với `format=png` ⚠️ | File `QR-BATCH-001.png` ≥ 512x512 px; quét ra đúng URL | AC-QR-02-S2 | API | M |
| TC-QR-07 | Như trên với `format=svg` ⚠️ | File `QR-BATCH-001.svg`, không vỡ nét khi phóng to | AC-QR-02-S3 | API | S |
| TC-QR-08 | Người dùng đơn vị A xin QR của `BATCH-B01`; và QR của `BATCH-999` không tồn tại | 404, không trả dữ liệu QR | AC-QR-02-E1 | API | M |
| TC-QR-09 | Gọi xin QR khi chưa đăng nhập hoặc token hết hạn | 401 | AC-QR-02-E2 | API | M |
| TC-QR-10 | `format=gif` | 400, liệt kê `png`, `svg` | AC-QR-02-E3 | API | S |
| TC-QR-11 | Mở `/trace/<qr_token hợp lệ>` không đăng nhập | 200: tên sản phẩm, mã lô, xuất xứ, đơn vị, timeline cũ đến mới; tải < 3 giây | AC-QR-03-S1 | API + Perf | M |
| TC-QR-12 | `GET /trace/code/BATCH-001` không đăng nhập | 200, cùng nội dung và giới hạn trường như TC-QR-11 | AC-QR-03-S2 | API | M |
| TC-QR-13 | Truy xuất lô vừa tạo, chỉ có sự kiện `CREATED` | 200 với đúng 1 sự kiện `CREATED` | AC-QR-03-S3 | API | M |
| TC-QR-14 | Truy xuất công khai lô có dữ liệu nội bộ | Phản hồi không có email, mã người dùng, mã người thực hiện, audit log | AC-QR-03-S4 | API | M |
| TC-QR-15 | Token không tồn tại hoặc sai chữ ký | 404 "Không tìm thấy thông tin truy xuất hợp lệ", không nêu lý do | AC-QR-03-E1 | API | M |
| TC-QR-16 | `GET /trace/code/BATCH-999` | 404 cùng thông báo như TC-QR-15 | AC-QR-03-E2 | API | M |
| TC-QR-17 | Một IP gửi 61 yêu cầu trong 1 phút tới endpoint truy xuất | Yêu cầu thứ 61 trả 429 | AC-QR-03-E3 | API | S |

### 5.2 CI/CD và Docker (TV4)
| Mã | Ca kiểm thử | Kết quả mong đợi | AC | Loại | Ưu tiên |
|---|---|---|---|---|---|
| TC-QA-01 | PR vào `main`, mọi test đạt, coverage ≥ 60% | Check `CI` xanh; đủ điều kiện merge sau 1 Approve | AC-QA-01-S1 | CI | M |
| TC-QA-02 | PR chỉ đổi file trong `docs/` | Check `CI` xanh, PR không bị chặn | AC-QA-01-S2 | CI | M |
| TC-QA-03 | PR có một test thất bại | Check `CI` đỏ, nút merge bị chặn, log nêu tên test và dòng lỗi | AC-QA-01-E1 | CI | M |
| TC-QA-04 | Mọi test đạt nhưng coverage < 60% | Check `CI` đỏ, thông báo coverage thấp hơn ngưỡng | AC-QA-01-E2 | CI | M |
| TC-QA-05 | `package-lock.json` không khớp `package.json` | Job dừng với lỗi rõ ràng, chạy lại được sau khi sửa | AC-QA-01-E3 | CI | S |
| TC-DEP-01 | Máy có Docker, `.env` từ `.env.example`, chạy `docker compose up --build` | Frontend, backend, database khởi động; backend kết nối DB; frontend truy cập được | AC-DEPLOY-01-S1 | Docker | M |
| TC-DEP-02 | `.env` thiếu `JWT_SECRET` hoặc `QR_HMAC_SECRET` | Backend dừng, nêu tên biến thiếu; không chạy với giá trị mặc định không an toàn | AC-DEPLOY-01-E1 | Docker | M |
| TC-DEP-03 | Cổng frontend bị chiếm | Docker báo xung đột cổng; README hướng dẫn đổi cổng | AC-DEPLOY-01-E2 | Docker | S |

### 5.3 Quản lý lô và timeline (TV2)
AC chi tiết của TV2 nằm trong `user-stories-batch.md`; các ca dưới đây ở mức User Story, ⚠️ cập nhật mã AC khi TV2 chốt.
| Mã | Ca kiểm thử | Kết quả mong đợi | Story | Loại | Ưu tiên |
|---|---|---|---|---|---|
| TC-BATCH-01 | Farmer tạo lô hợp lệ, kiểm tra DB sau khi tạo | 201; Batch, QRCode, sự kiện `CREATED` cùng tồn tại (một transaction) | US-B01 | API + DB | M |
| TC-BATCH-02 | Tạo lô thiếu tên hoặc số lượng ≤ 0 | 400; không lưu Batch, QR, sự kiện | US-B01 | API | M |
| TC-BATCH-03 | Tạo lô bằng tài khoản không phải Farmer; và khi chưa đăng nhập | 403; 401 | US-B01 | API | M |
| TC-BATCH-04 | Farmer sửa thông tin lô `BATCH-001` đang `CREATED` | 200; dữ liệu cập nhật | US-B02 | API | M |
| TC-BATCH-05 | Sửa lô `BATCH-002` đã chuyển khỏi `CREATED` ⚠️ | Từ chối (409 đề xuất); dữ liệu không đổi | US-B02 | API | M |
| TC-BATCH-06 | Sửa lô của đơn vị khác hoặc lô không tồn tại | 404; dữ liệu không đổi | US-B02 | API | M |
| TC-BATCH-07 | Danh sách lô cho Farmer, Processor, Distributor, Admin ⚠️ | Mỗi vai trò chỉ thấy lô trong phạm vi được phép; Admin thấy tất cả | US-B03 | API | M |
| TC-BATCH-08 | Lọc theo `status` hợp lệ; và `status` không hợp lệ | Kết quả đúng; 400 kèm giá trị hợp lệ | US-B03 | API | M |
| TC-BATCH-09 | Tìm kiếm không khớp lô nào | 200 và danh sách rỗng | US-B03 | API | S |
| TC-BATCH-10 | Nhập chuỗi `' OR 1=1 --` vào ô tìm kiếm và mã lô | Không lộ thêm dữ liệu, không lỗi 500 | US-B03 | API | M |
| TC-BATCH-11 | Danh sách lô khi chưa đăng nhập | 401 | US-B03 | API | M |
| TC-BATCH-12 | Xem chi tiết lô trong phạm vi | 200 đủ sản phẩm, nguồn gốc, số lượng, trạng thái, người tạo | US-B04 | API | M |
| TC-BATCH-13 | Xem lô ngoài phạm vi hoặc không tồn tại | 404 | US-B04 | API | M |
| TC-BATCH-14 | Xem chi tiết khi chưa đăng nhập | 401 | US-B04 | API | M |
| TC-BATCH-15 | Xem timeline lô trong phạm vi | Thông tin tổng quan; sự kiện theo thời gian tăng dần | US-B05 | API | M |
| TC-BATCH-16 | Timeline của lô vừa tạo | Đúng 1 sự kiện `CREATED` | US-B05 | API | M |
| TC-BATCH-17 | Timeline lô ngoài phạm vi; và khi chưa đăng nhập | 404; 401 | US-B05 | API | M |
| TC-BATCH-18 | Phân trang: trang rỗng, `limit` quá lớn, `limit` âm | Danh sách rỗng hoặc 400, không lỗi 500 | US-B03 | API | S |
| TC-EVT-01..04 | Toàn vẹn chuỗi: thứ tự trạng thái, thời gian không hợp lệ, sự kiện trùng, sai vai trò | ⚠️ Chờ story và AC sự kiện (Tuần 6) | (chờ) | API | M |

### 5.4 Tài khoản, hồ sơ và giao diện (TV1, TV3)
| Mã | Ca kiểm thử | Kết quả mong đợi | AC | Loại | Ưu tiên |
|---|---|---|---|---|---|
| TC-AUTH-01 | Đăng ký hợp lệ vai trò Farmer | Thành công; tài khoản PENDING; không có token | US-UI01-AC01 | API | M |
| TC-AUTH-02 | Đăng ký thiếu trường bắt buộc hoặc email sai định dạng | 400, lỗi theo trường | US-UI01-AC02 | API | M |
| TC-AUTH-03 | Đăng ký bằng email đã dùng ⚠️ | Lỗi, không tạo tài khoản mới (mã và thông báo chờ TV3) | US-UI01-AC02 | API | M |
| TC-AUTH-04 | Đăng ký với vai trò Admin | Bị từ chối | US-UI01-AC03 | API | M |
| TC-AUTH-05 | Đăng nhập tài khoản ACTIVE đúng thông tin | 200 kèm token và vai trò | US-UI02-AC01 | API | M |
| TC-AUTH-06 | Sai mật khẩu; và email không tồn tại | 401, cùng thông báo chung "Email hoặc mật khẩu không đúng" | US-UI02-AC02 | API | M |
| TC-AUTH-07 | Đăng nhập tài khoản PENDING; và LOCKED | Bị từ chối theo trạng thái; không phát token | US-UI02-AC03 | API | M |
| TC-AUTH-08 | Gọi endpoint nội bộ với token thiếu, sai hoặc hết hạn | 401 | FR-UI-21 | API | M |
| TC-AUTH-09 | `GET /users/me` | Có họ tên, email, vai trò, đơn vị; không có mật khẩu hoặc giá trị băm | US-UI03-AC01 | API | M |
| TC-AUTH-10 | `PATCH /users/me` đổi tên hợp lệ; và tên rỗng | 200 với tên mới; 400 | US-UI03-AC02, AC04 | API | M |
| TC-AUTH-11 | Đổi mật khẩu đúng mật khẩu hiện tại | Thành công | US-UI03-AC03 | API | S |
| TC-AUTH-12 | Đổi mật khẩu sai mật khẩu hiện tại, mật khẩu mới không đạt chính sách ⚠️ | Lỗi, mật khẩu không đổi | US-UI03-AC04 | API | S |
| TC-AUTH-13 | Cố sửa email, vai trò, trạng thái, đơn vị qua `PATCH /users/me` | Bị bỏ qua hoặc từ chối; giá trị không đổi | US-UI03-AC04 | API | M |
| TC-AUTH-14 | Kiểm tra DB sau khi đăng ký | Mật khẩu lưu dạng băm, không lưu thô | NFR-02 | API + DB | M |
| TC-UI-01 | Đăng ký trên giao diện | Thông báo "chờ duyệt" và liên kết tới đăng nhập; không vào dashboard | US-UI01-AC01 | UI | M |
| TC-UI-02 | Đăng nhập trên giao diện | Chuyển tới dashboard, menu theo vai trò | US-UI02-AC01 | UI | M |
| TC-UI-03 | Dashboard khi danh sách rỗng; và khi API lỗi | "Chưa có lô trong phạm vi của bạn"; thông báo lỗi kèm Thử lại (hai trạng thái khác nhau) | US-UI04-AC02 | UI | M |
| TC-UI-04 | Menu và truy cập trực tiếp URL ngoài quyền | Menu không hiện chức năng ngoài quyền; trang không lộ dữ liệu | US-UI04-AC03 | UI | M |
| TC-UI-05 | Tra cứu mã lô: mã trống; mã có khoảng trắng đầu/cuối | Mã trống không gọi API; khoảng trắng được cắt | US-UI05-AC01, AC02 | UI | M |
| TC-UI-06 | Tra cứu khi mất kết nối | Báo lỗi, giữ mã đã nhập, có Thử lại, không kết luận mã không tồn tại | US-UI05-AC03 | UI | S |
| TC-UI-07 | Kết quả truy xuất trên màn hình 360 px | Thông tin lô trước timeline; không cuộn ngang; không lộ dữ liệu nội bộ | US-UI06-AC01, AC02 | UI | M |
| TC-UI-08 | QR hoặc mã lô không hợp lệ | Một thông báo thống nhất và liên kết về trang nhập mã | US-UI06-AC03 | UI | M |
| TC-UI-09 | Lỗi tải kết quả truy xuất; và lỗi 429 ⚠️ | Thông báo lỗi kèm Thử lại; không hiện dữ liệu mẫu như kết quả thật | US-UI06-AC04 | UI | S |
| TC-UI-10 | Đăng xuất, rồi Quay lại, tải lại hoặc mở trực tiếp dashboard | Về trang đăng nhập; không hiện lại dữ liệu nội bộ | US-UI07-AC01, AC02 | UI | M |
| TC-SEC-xx | Bảo mật và dữ liệu (RBAC, audit log, khóa tài khoản) | ⚠️ Chờ User Story của TV3 | (chờ) | API | M |

---

## 6. Ma trận truy vết

| User Story | Yêu cầu chức năng | Ca kiểm thử | Chạy ở tuần |
|---|---|---|---|
| US-UI01 Đăng ký | FR-UI-01..03 | TC-AUTH-01..04, TC-UI-01 | 4 |
| US-UI02 Đăng nhập | FR-UI-04..06 | TC-AUTH-05..08, TC-UI-02 | 4 |
| US-UI03 Hồ sơ | FR-UI-07..10 | TC-AUTH-09..13 | 4 |
| US-UI04 Dashboard | FR-UI-11..13 | TC-UI-03, TC-UI-04 | 5 |
| US-UI05 Tra cứu mã lô | FR-UI-14, FR-UI-15 | TC-UI-05, TC-UI-06 | 7 |
| US-UI06 Kết quả truy xuất | FR-UI-16..18 | TC-UI-07..09 | 7 |
| US-UI07 Đăng xuất | FR-UI-19, FR-UI-20 | TC-UI-10 | 4 |
| US-B01 Tạo lô | FR-BATCH-01..03, 12 | TC-BATCH-01..03 | 5 |
| US-B02 Cập nhật lô | FR-BATCH-04..06 | TC-BATCH-04..06 | 5 |
| US-B03 Tìm kiếm và lọc | FR-BATCH-07..09 | TC-BATCH-07..11, 18 | 5 |
| US-B04 Chi tiết lô | FR-BATCH-10 | TC-BATCH-12..14 | 5 |
| US-B05 Timeline | FR-BATCH-11 | TC-BATCH-15..17, TC-EVT-01..04 | 6 |
| US-QR-01 QR có HMAC | FR-QR-01, FR-QR-02, NFR-03 | TC-QR-01..04 | 5 đến 7 |
| US-QR-02 Xem và tải QR | FR-QR-03, FR-QR-04 | TC-QR-05..10 | 7 |
| US-QR-03 Truy xuất công khai | FR-QR-05..08, NFR-01, NFR-04 | TC-QR-11..17 | 7 |
| US-QA-01 CI mỗi PR | FR-QA-01, FR-QA-02, NFR-05, NFR-09 | TC-QA-01..05 | 4 |
| US-DEPLOY-01 Docker | FR-DEP-01, FR-DEP-02, NFR-07 | TC-DEP-01..03 | 8 |
| US-SEC (TV3) | FR mục 3.5 (chờ) | TC-SEC-xx (chờ) | 4 đến 7 |

**Thống kê hiện có:** 17 TC nhóm QR, 8 TC nhóm CI và Docker, 18 TC nhóm lô và timeline, 14 TC API tài khoản, 10 TC giao diện; tổng 67 TC đã mô tả, chưa tính TC-EVT và TC-SEC đang chờ AC.

---

## 7. Lịch kiểm thử

| Tuần | Trọng tâm | Ca kiểm thử chính |
|---|---|---|
| 3 | Thiết kế ca kiểm thử, test plan, ma trận truy vết; rà soát nhất quán UML, ERD, OpenAPI | (tài liệu này) |
| 4 | Tài khoản, xác thực, phân quyền; CI cơ bản; bật ggshield | TC-AUTH-01..14, TC-UI-01, 02, 10, TC-QA-01..05 |
| 5 | Quản lý lô, transaction, phạm vi đọc | TC-BATCH-01..14, 18, TC-QR-01..04, TC-UI-03, 04 |
| 6 | Sự kiện chuỗi và toàn vẹn timeline; Fagan Inspection | TC-BATCH-15..17, TC-EVT-01..04 |
| 7 | QR, truy xuất công khai, E2E, rate limit, Trivy | TC-QR-05..17, TC-UI-05..09, E2E từ tạo lô đến quét QR |
| 8 | Hồi quy toàn bộ, đo coverage, Docker, báo cáo | Toàn bộ TC Must, TC-DEP-01..03 |

---

## 8. Vai trò và trách nhiệm

| Vai trò | Thành viên | Trách nhiệm kiểm thử |
|---|---|---|
| QA, CI, QR | TV4 | Test plan, bộ API/E2E, CI, báo cáo; viết TC-QR, TC-QA, TC-DEP |
| Frontend | TV1 | TC-UI, kiểm thử component; review TV2 |
| Backend | TV2 | Unit và API test cho Batch, Event, Trace; sửa lỗi |
| Database, Auth, Security | TV3 | Seed dữ liệu, test Auth/RBAC, checklist bảo mật; review TV4 |

Review chéo: TV1 review TV2, TV2 review TV3, TV3 review TV4, TV4 review TV1.

---

## 9. Quản lý lỗi

| Mức | Mô tả | Xử lý |
|---|---|---|
| Critical | Lộ dữ liệu, bỏ qua phân quyền, SQL Injection, mất dữ liệu | Sửa ngay, chặn merge |
| High | Chức năng chính sai, sai mã lỗi quan trọng | Sửa trong tuần |
| Medium | Chức năng phụ sai, lỗi giao diện đáng kể | Sửa trước khi chốt tuần |
| Low | Lỗi hiển thị nhỏ | Sửa khi có thời gian |

Mỗi lỗi tạo thành GitHub Issue với label `type: bug`, mức `priority:`, tuần `week-x`, liên kết mã TC bị lỗi. Nội dung Issue: các bước tái hiện, kết quả mong đợi và thực tế, ảnh hoặc log.

**Mẫu báo cáo kết quả theo tuần**
| Tuần | Tổng TC chạy | Đạt | Không đạt | Bị chặn | Coverage |
|---|---|---|---|---|---|
| 4 | | | | | |
| 5 | | | | | |
| 6 | | | | | |
| 7 | | | | | |
| 8 | | | | | |

---

## 10. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Điểm chờ xác nhận (mã lỗi, cấu trúc token, endpoint QR) thay đổi, ảnh hưởng nhiều TC | Giữ TC liên kết AC; cập nhật hàng loạt theo SRS mục 10 và 11 |
| Dồn kiểm thử động về Tuần 8, không kịp sửa lỗi | Chạy TC theo lịch mục 7; CI chạy mỗi PR |
| Coverage đạt 60% nhưng bỏ sót nhánh lỗi | Ưu tiên TC lấy từ AC kịch bản lỗi và phân quyền |
| E2E chập chờn | Dữ liệu thử riêng, khởi tạo lại trước mỗi lần chạy |
| Thiếu seed dữ liệu thống nhất | Thống nhất tên mã seed với TV3 ngay Tuần 4 |
| Cấu hình CI sai chặn nhầm PR | Thử CI trên nhánh riêng trước khi bật branch protection |

---

## 11. Điểm chờ xác nhận (liên kết SRS mục 10 và 11)

| # | Nội dung | Người xác nhận | Ảnh hưởng TC |
|---|---|---|---|
| 1 | Cấu trúc `qr_token`, tên biến `QR_HMAC_SECRET` (P1, P2) | TV2 | TC-QR-01..04, TC-DEP-02 |
| 2 | Endpoint `GET /batches/{batchId}/qr` và định dạng phản hồi (P3) | TV2 | TC-QR-05..10 |
| 3 | Mã lỗi khi lô đã đổi trạng thái (400 hay 409) | TV2, TV3 | TC-BATCH-05 |
| 4 | Phạm vi đọc lô của Processor, Distributor ("đã tiếp nhận/xử lý" hay chỉ "thuộc đơn vị") | TV2 | TC-BATCH-07, 12, 15 |
| 5 | Chính sách mật khẩu, mã lỗi email trùng (P5, P6) | TV3 | TC-AUTH-03, 12 |
| 6 | Hiển thị lỗi 429 trên giao diện (P4) | TV1, TV2 | TC-UI-09 |
| 7 | AC cho sự kiện chuỗi cung ứng và story bảo mật (TV3) | TV2, TV3 | TC-EVT, TC-SEC |
