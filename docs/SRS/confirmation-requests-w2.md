# Phiếu xác nhận Tuần 2 (TV4 gửi các thành viên)

**Cách dùng:** gửi nội dung từng mục A, B, C cho người nhận (nhắn tin nhóm hoặc comment trên PR/Issue). Người nhận trả lời "OK" hoặc sửa lại. TV4 cập nhật mục 10 của `SRS-v1.md`: đổi ⚠️ thành ✅ và chỉnh nội dung nếu có thay đổi.

## Bảng theo dõi
| # | Người nhận | Nội dung | Trạng thái |
|---|---|---|---|
| A | TV2 (Trí) | Token HMAC, endpoint QR, endpoint công khai, 4 điểm lệch trong `user-stories-batch.md` | ⬜ Chưa gửi |
| B | TV1 (Bảo) | Kịch bản 429, thông báo 404 dùng chung, mã story, Retailer, thời điểm tạo Issue | ⬜ Chưa gửi |
| C | TV3 | Story bảo mật cho SRS 3.5, chính sách mật khẩu, mã lỗi, email trùng, đăng xuất, trạng thái lô, bảng QRCode | ⬜ Chưa gửi |

---

## A. Gửi Trí (TV2)

> Chào Trí, mình là Bình (TV4). Mình đang tổng hợp SRS v1 và đối chiếu story QR của mình với US-B01..B05 của bạn (PR #25). Nhờ bạn xác nhận hoặc sửa giúp mình:
>
> 1. **Token QR.** Mình đã sửa US-QR-01 theo US-B01 (QR sinh cùng transaction, token có chữ ký HMAC). Bạn đồng ý với cấu trúc `qr_token = <batch_code>.<signature>`, trong đó `signature = base64url(HMAC-SHA256(QR_HMAC_SECRET, batch_code))` và tên biến môi trường `QR_HMAC_SECRET` không? Nếu bạn đã có cấu trúc khác thì gửi mình để mình sửa cho khớp.
> 2. **Endpoint xem/tải QR.** Mình đề xuất thêm `GET /batches/{batchId}/qr`, trả JSON `{batchCode, qrToken, traceUrl}`; kèm `?format=png|svg` thì trả ảnh. Bạn thêm vào `api-endpoints-draft.md` và OpenAPI giúp mình được không?
> 3. **Endpoint công khai.** `GET /trace/{qrToken}` và `GET /trace/code/{batchCode}` cùng trả 404 với thông báo "Không tìm thấy thông tin truy xuất hợp lệ", cùng giới hạn 60 yêu cầu/phút/IP (vượt thì 429, kèm header `Retry-After`). Bạn đồng ý và phía backend làm được chứ?
> 4. **Bốn chỗ lệch trong `user-stories-batch.md`:**
>    - US-B03 cho Distributor/Processor thấy lô "đã tiếp nhận/xử lý", nhưng US-B04 và B05 chỉ nói lô "thuộc đơn vị". Hậu quả là thấy lô trong danh sách nhưng bị 404 khi mở chi tiết hoặc timeline. Cần một định nghĩa phạm vi đọc duy nhất.
>    - US-B02 còn ghi "400 hoặc 409" và "404 hoặc 403". Mình đề xuất chốt 409 và 404 cho khớp quy ước đầu tài liệu.
>    - Retailer không xuất hiện trong US-B03. Giữ hay bỏ vai trò này?
>    - Ghi chú cuối tài liệu gọi endpoint công khai là "US-B04 của TV4". Story của mình là US-QR-03, bạn sửa giúp.
>
> Cảm ơn bạn!

## B. Gửi Bảo (TV1)

> Chào Bảo, mình là Bình (TV4). Mình đang tổng hợp SRS v1 từ User Story của bạn. Nhờ bạn xác nhận giúp mình:
>
> 1. **Thêm kịch bản 429 vào US-UI06.** Đề xuất: *Given* trình duyệt đã gửi quá nhiều yêu cầu truy xuất; *When* mở kết quả; *Then* hiển thị "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút", không kết luận mã lô không tồn tại và có thao tác Thử lại.
> 2. **Thông báo 404 dùng chung:** "Không tìm thấy thông tin truy xuất hợp lệ". US-UI06 đang dùng câu này, US-QR-03 của mình cũng đã dùng. Bạn đồng ý chứ?
> 3. **Token QR** là `qr_token` có chữ ký HMAC (US-UI06 đang nhắc "sai chữ ký"), endpoint `/trace/{qrToken}` và `/trace/code/{batchCode}`. Bạn đồng ý chứ?
> 4. **Mã User Story.** SRS giữ nguyên mã gốc của từng người (US-UI01, US-B01, US-QR-01) và Acceptance Criteria giữ định dạng riêng của từng tác giả. Bạn đồng ý chứ?
> 5. **Retailer.** US-UI01 chỉ cho đăng ký Farmer, Processor, Distributor. Mình đang chờ TV3 chốt có giữ Retailer không.
> 6. **GitHub Issue.** Mốc tuần 2 yêu cầu các story phải thành Issue, hạn là 19/10. Bạn dự định tạo Issue cho 7 story khi nào?
>
> Cảm ơn bạn!

## C. Gửi TV3

> Chào bạn, mình là Bình (TV4). Mục 3.5 của SRS v1 (yêu cầu bảo mật và dữ liệu) đang chờ User Story của bạn. Khi xong bạn gửi mình file hoặc link PR nhé. Ngoài ra nhờ bạn chốt các điểm đang mở. Mình đã ghi sẵn đề xuất mặc định, bạn chỉ cần trả lời OK hoặc sửa:
>
> 1. **Chính sách mật khẩu:** tối thiểu 8 ký tự, có cả chữ và số.
> 2. **Phạm vi đọc lô** theo đơn vị (`organization_id`), Admin xem tất cả. Truy cập ngoài phạm vi hoặc không tồn tại trả 404, sai vai trò trả 403, chưa đăng nhập trả 401 (theo `user-stories-batch.md`). Khớp với ma trận quyền chứ?
> 3. **Email trùng khi đăng ký:** báo "Email đã được sử dụng" kèm giới hạn tần suất. Màn hình đăng nhập giữ thông báo chung "Email hoặc mật khẩu không đúng".
> 4. **Đăng xuất:** JWT sống ngắn (ví dụ 1 giờ), không thu hồi phía server trong phạm vi đồ án. US-UI07 chỉ xóa phiên ở frontend.
> 5. **Luồng đăng ký:** trạng thái `PENDING`, Admin duyệt và gán đơn vị. Bạn đưa endpoint chi tiết vào OpenAPI giúp.
> 6. **Vai trò Retailer:** giữ hay bỏ? Nếu giữ thì cần bổ sung vào đăng ký (US-UI01) và US-B03.
> 7. **Trạng thái lô:** dùng 6 tên theo báo cáo tiến độ (`CREATED`, `TRANSPORTED`, `RECEIVED`, `PROCESSED`, `PACKAGED`, `SHIPPED`). ERD cần khớp.
> 8. **Bảng QRCode trong ERD:** `(batch_id, qr_token, created_at)`, tạo cùng transaction với Batch và sự kiện `CREATED`.
>
> Cảm ơn bạn!

---

## Sau khi nhận trả lời
- [ ] Cập nhật mục 10 của `SRS-v1.md`: đổi ⚠️ thành ✅ ở các dòng đã được xác nhận, sửa nội dung nếu người nhận đề xuất khác
- [ ] Cập nhật mục 11 (đề xuất P1..P9) nếu có thay đổi
- [ ] Nếu TV2 đổi cấu trúc token hoặc tên biến: sửa US-QR-01, US-DEPLOY-01, FR-QR-01, NFR-03
- [ ] Khi TV3 gửi story: điền mục 3.5 của SRS và thêm vào mục 3.1
- [ ] Cập nhật cột "Trạng thái" trong bảng theo dõi ở đầu file này
