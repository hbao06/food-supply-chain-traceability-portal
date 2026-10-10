# Danh sách màn hình dự kiến — W1-Hoài Bảo

**Dự án:** Hệ thống truy xuất nguồn gốc thực phẩm  
**Người phụ trách:** Hoài Bảo — Frontend/UI-UX  
**Người review:** Lê Bá Khánh Bình  
**Trạng thái:** Hoàn thành danh sách màn hình tuần 1 — Chờ review.

## 1. Giao diện công khai

Người tiêu dùng sử dụng các màn hình này mà không cần đăng nhập.

| Mã    | Màn hình          | Mục đích                           | Nội dung và thao tác chính                                                                                                                                  | Wireframe tuần 1          |
| ----- | ----------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| UI-01 | Tra cứu nguồn gốc | Bắt đầu tra cứu một lô thực phẩm   | Nhập mã lô, bấm tra cứu; hỗ trợ luồng quét QR. Cách tra cứu bằng mã lô cần thống nhất với Backend.                                                          | Có                        |
| UI-02 | Kết quả truy xuất | Xem nguồn gốc và hành trình của lô | Thông tin sản phẩm, mã lô, nguồn gốc, trạng thái và timeline công khai; chỉ hiển thị dữ liệu được phép công khai. QR có thể dẫn trực tiếp đến màn hình này. | Có, thuộc luồng truy xuất |

## 2. Tài khoản và giao diện chung

| Mã    | Màn hình      | Người sử dụng           | Mục đích                                 | Nội dung và thao tác chính                                                                                                                 | Wireframe tuần 1 |
| ----- | ------------- | ----------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| UI-03 | Đăng nhập     | Người có tài khoản      | Truy cập hệ thống nội bộ                 | Nhập email và mật khẩu, đăng nhập; thông báo khi thiếu dữ liệu hoặc đăng nhập thất bại; thành công chuyển đến dashboard.                   | Có               |
| UI-04 | Đăng ký       | Người chưa có tài khoản | Tạo tài khoản                            | Nhập thông tin đăng ký, kiểm tra dữ liệu, hiển thị kết quả. Không tự chọn Admin; cách gán các vai trò khác chờ nhóm thống nhất.            | Không            |
| UI-05 | Dashboard     | Người đã đăng nhập      | Đi đến các chức năng phù hợp với vai trò | Thông tin người dùng, menu theo quyền, lô gần đây và các thao tác được phép. Chỉ bổ sung số liệu tổng quan sau khi thống nhất dữ liệu API. | Có               |
| UI-06 | Hồ sơ cá nhân | Người đã đăng nhập      | Xem và cập nhật thông tin cá nhân        | Hiển thị hồ sơ, chỉnh sửa các trường được phép, lưu thay đổi và thông báo kết quả.                                                         | Không            |

## 3. Quản lý lô và sự kiện

| Mã    | Màn hình     | Người sử dụng                          | Mục đích                               | Nội dung và thao tác chính                                                                                                                        | Wireframe tuần 1 |
| ----- | ------------ | -------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| UI-07 | Danh sách lô | Người đã đăng nhập, theo phạm vi quyền | Tìm và chọn lô cần thao tác            | Danh sách lô, tìm kiếm theo mã, lọc trạng thái, mở chi tiết; Farmer chỉ thấy lô của mình theo bản nháp API.                                       | Không            |
| UI-08 | Tạo lô       | Farmer                                 | Ghi nhận lô thực phẩm mới              | Form thông tin lô và nguồn gốc, kiểm tra dữ liệu, gửi tạo lô; hiển thị lỗi thiếu dữ liệu hoặc trùng mã. Các trường cụ thể chờ thống nhất ERD/API. | Không            |
| UI-09 | Chi tiết lô  | Người có quyền xem lô                  | Xem thông tin và lịch sử của một lô    | Thông tin lô, trạng thái hiện tại, timeline nội bộ và vùng QR; nút cập nhật hoặc thêm sự kiện theo quyền.                                         | Không            |
| UI-10 | Cập nhật lô  | Farmer là chủ lô                       | Chỉnh sửa thông tin được phép          | Form điền sẵn dữ liệu, lưu thay đổi, thông báo kết quả. Phạm vi trường được sửa và điều kiện sửa chờ nhóm thống nhất.                             | Không            |
| UI-11 | Thêm sự kiện | Distributor, Processor, theo quyền     | Ghi nhận một bước trong chuỗi cung ứng | Chọn loại sự kiện hợp lệ; nhập thời gian, địa điểm, đơn vị và thông tin cần thiết; gửi và hiển thị lỗi dữ liệu, quyền hoặc thứ tự trạng thái.     | Không            |

## 4. Quản trị

Các màn hình dưới đây được đề xuất theo nhóm endpoint quản trị trong bản nháp của TV2. Nhóm cần xác nhận phạm vi trước khi thiết kế chi tiết.

| Mã    | Màn hình           | Người sử dụng | Mục đích                           | Nội dung và thao tác chính                                                                        | Wireframe tuần 1 |
| ----- | ------------------ | ------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------- |
| UI-12 | Quản lý người dùng | Admin         | Quản lý tài khoản và quyền         | Danh sách người dùng, đổi vai trò, khóa hoặc mở khóa tài khoản; xác nhận trước thao tác thay đổi. | Không            |
| UI-13 | Quản lý đơn vị     | Admin         | Quản lý tổ chức tham gia hệ thống  | Danh sách đơn vị, tạo và cập nhật đơn vị bằng form.                                               | Không            |
| UI-14 | Nhật ký hoạt động  | Admin         | Tra cứu hoạt động thay đổi dữ liệu | Danh sách audit log; lọc theo lô, người thực hiện, loại sự kiện và khoảng thời gian; chỉ xem.     | Không            |

## 5. Thành phần và trạng thái dùng chung

Các mục này được tích hợp vào màn hình liên quan, không tính thành màn hình riêng.

| Thành phần hoặc trạng thái          | Cách sử dụng                                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| Thanh điều hướng và menu theo quyền | Dùng trong giao diện nội bộ; có thông tin người dùng, liên kết hồ sơ và thao tác đăng xuất.        |
| Timeline                            | Hiển thị trong chi tiết lô và kết quả truy xuất; dữ liệu nội bộ và công khai có phạm vi khác nhau. |
| Vùng mã QR                          | Hiển thị trong chi tiết lô; phối hợp với TV4 về sinh và tải QR.                                    |
| Đang tải                            | Báo cho người dùng biết hệ thống đang lấy hoặc gửi dữ liệu.                                        |
| Dữ liệu rỗng                        | Hiển thị khi chưa có lô, sự kiện hoặc kết quả trong danh sách.                                     |
| Lỗi nhập liệu hoặc lỗi API          | Hiển thị thông báo rõ ràng và giữ dữ liệu đã nhập khi phù hợp.                                     |
| Không tìm thấy                      | Dùng khi mã lô/QR hoặc tài nguyên không tồn tại.                                                   |
| Chưa đăng nhập hoặc phiên hết hạn   | Thông báo và hướng người dùng đăng nhập lại.                                                       |
| Không có quyền                      | Thông báo khi người dùng truy cập hoặc thực hiện thao tác ngoài quyền được cấp.                    |

## 6. Luồng điều hướng chính

**Người tiêu dùng:** Tra cứu nguồn gốc → Kết quả truy xuất. Quét QR có thể mở trực tiếp kết quả truy xuất.

**Người dùng nội bộ:** Đăng nhập → Dashboard → Danh sách lô → Chi tiết lô → Cập nhật lô hoặc thêm sự kiện theo quyền. Hồ sơ và các chức năng Admin được truy cập từ menu phù hợp.

## 7. Phạm vi wireframe tuần 1

- **Đăng nhập:** bố trí form và trạng thái lỗi.
- **Dashboard:** bố trí menu theo quyền, vùng nội dung và trạng thái chưa có dữ liệu.
- **Truy xuất:** bố trí phần nhập mã, kết quả và trạng thái không tìm thấy; có bản bố trí trên điện thoại.

Danh sách màn hình được cập nhật khi nhóm thống nhất User Story, ma trận quyền và API. Wireframe được hoàn thiện trong tuần 3.

# Ghi chú triển khai wireframe — W1-Hoài Bảo

Người phụ trách: Hoài Bảo — Frontend/UI-UX.
Người review: Lê Bá Khánh Bình.

## Phạm vi

Bốn trang: đăng nhập, dashboard của Farmer, nhập mã truy xuất và kết quả truy xuất. Dữ liệu trong wireframe là minh họa. Các vòng tròn đánh số là chú thích thiết kế, không phải thành phần giao diện sản phẩm.

## Đối chiếu API dự kiến của Chung Nguyễn Minh Trí

- Đăng nhập: POST /auth/login.
- Dashboard: GET /batches, giới hạn lô theo quyền người dùng.
- Nhập mã lô: GET /trace/code/{batchCode}.
- Quét QR: GET /trace/{qrToken}.
- Truy xuất công khai chỉ dùng các trường được phép công khai.

## Các điểm cần thống nhất

- Trường đăng nhập là email hay tên đăng nhập.
- Tên trạng thái và loại sự kiện thống nhất với UML, ERD và API.
- Phạm vi dữ liệu theo vai trò, cùng Đặng Vĩnh Quang và Chung Nguyễn Minh Trí.
- Sinh/tải QR phối hợp với Lê Bá Khánh Bình. Bản này dùng camera điện thoại mở QR; quét bằng camera ngay trong website chưa được chốt.

## Quy tắc bố trí và trạng thái

- Trên điện thoại: thông tin lô nằm trước timeline, không cuộn ngang.
- Khi gửi form: có trạng thái đang xử lý, tránh gửi lặp.
- Mất kết nối hoặc tải dữ liệu thất bại: thông báo rõ và có thao tác thử lại.
- Thông báo lỗi chỉ hiện khi có lỗi, không xuất hiện trong màn hình mặc định.

## Bàn giao

Lưu file draw.io và ảnh vào docs/wireframes trên nhánh frontend. Nội dung này có thể đưa vào tài liệu ui-screen-list.md. Gửi PR W1-Hoài Bảo cho Lê Bá Khánh Bình review.
