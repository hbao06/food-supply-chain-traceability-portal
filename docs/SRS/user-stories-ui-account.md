# User Story giao diện và tài khoản — W2-Hoài Bảo

**Dự án:** Food Supply Chain Traceability & Provenance Portal — Nhóm 13

**Người phụ trách:** Trương Huỳnh Hoài Bảo — Frontend / UI-UX

**Người review:** Lê Bá Khánh Bình

**Thời gian thực hiện:** 13/10/2026–19/10/2026

**Trạng thái:** Hoài Bảo đã kiểm tra và đồng ý bàn giao — Chờ Lê Bá Khánh Bình review.

**Bàn giao:** 7 User Story, bao phủ đăng ký, đăng nhập, hồ sơ, dashboard và giao diện truy xuất; bổ sung đăng xuất.

## 1. Phạm vi và tài liệu tham chiếu

Tài liệu mô tả nhu cầu và hành vi giao diện để thiết kế, triển khai và kiểm thử; không khẳng định các chức năng hoặc endpoint đã được lập trình.

- [Danh sách màn hình và ghi chú wireframe tuần 1](../ui-screen-list.md).
- [Bản nháp endpoint](../api-endpoints-draft.md).
- [Ma trận phân quyền nháp](../permission-matrix.md).
- [ERD nháp v2](../ERD/erd-draft.md).
- [OpenAPI hiện có](../openapi-spec.yaml).

Đăng ký chờ duyệt, trường hồ sơ và phạm vi dữ liệu dưới đây theo đề xuất trong ma trận quyền/ERD. Các khác biệt giữa tài liệu nháp và OpenAPI được liệt kê ở mục 5, cần nhóm xác nhận trước khi chốt API. Consumer dùng giao diện công khai, không cần tạo tài khoản.

## 2. Danh sách User Story

| Mã | User Story | Vai trò | Màn hình | API tham chiếu dự kiến |
| --- | --- | --- | --- | --- |
| US-UI01 | Đăng ký tài khoản | Người chưa có tài khoản | UI-04 | `POST /auth/register` |
| US-UI02 | Đăng nhập hệ thống | Người có tài khoản | UI-03 | `POST /auth/login` |
| US-UI03 | Xem và cập nhật hồ sơ cá nhân | Người đã đăng nhập | UI-06 | `GET /users/me`, `PATCH /users/me` |
| US-UI04 | Sử dụng dashboard theo quyền | Người đã đăng nhập | UI-05 | `GET /users/me`, `GET /batches` |
| US-UI05 | Tra cứu nguồn gốc bằng mã lô | Consumer | UI-01 | `GET /trace/code/{batchCode}` |
| US-UI06 | Xem kết quả truy xuất từ mã lô hoặc QR | Consumer | UI-02 | `GET /trace/code/{batchCode}`, `GET /trace/{qrToken}` |
| US-UI07 | Đăng xuất khỏi giao diện nội bộ | Người đã đăng nhập | Menu chung | Xóa phiên tại frontend; API thu hồi token chưa được chốt |

## 3. User Story và Acceptance Criteria

### US-UI01: Đăng ký tài khoản

**As a** người chưa có tài khoản tham gia chuỗi cung ứng,

**I want** đăng ký tài khoản bằng thông tin cá nhân và vai trò nghiệp vụ,

**So that** tôi có thể đề nghị được cấp quyền sử dụng hệ thống nội bộ.

**AC01 — Đăng ký thành công**
- **Given** tôi mở màn hình đăng ký và email chưa được sử dụng.
- **When** tôi nhập họ tên, email hợp lệ, mật khẩu đáp ứng chính sách đã thống nhất, xác nhận mật khẩu trùng khớp và chọn Farmer, Processor hoặc Distributor rồi gửi.
- **Then** sau khi API xác nhận thành công, giao diện thông báo tài khoản đang chờ duyệt và có liên kết đến đăng nhập; không tự mở dashboard hoặc cấp quyền nội bộ cho tài khoản PENDING.

**AC02 — Dữ liệu không hợp lệ hoặc email đã được sử dụng**
- **Given** tôi đang nhập thông tin đăng ký.
- **When** tôi bỏ trống trường bắt buộc, nhập email sai định dạng, xác nhận mật khẩu không khớp hoặc API từ chối email đã được sử dụng.
- **Then** giao diện hiển thị lỗi tương ứng, không thông báo đăng ký thành công và giữ các thông tin không nhạy cảm để tôi sửa; lỗi có thể kiểm tra tại giao diện được chặn trước khi gửi.

**AC03 — Giới hạn vai trò**
- **Given** tôi đang ở màn hình đăng ký.
- **When** tôi xem các vai trò có thể chọn hoặc yêu cầu đăng ký bị backend từ chối vì vai trò không hợp lệ.
- **Then** giao diện không cung cấp lựa chọn Admin, không cho tự gán đơn vị và hiển thị lỗi khi yêu cầu bị từ chối; backend vẫn phải kiểm tra quyền độc lập với giao diện.

### US-UI02: Đăng nhập hệ thống

**As a** người đã có tài khoản,

**I want** đăng nhập bằng email và mật khẩu,

**So that** tôi truy cập được các chức năng nội bộ phù hợp với quyền được cấp.

**AC01 — Đăng nhập thành công**
- **Given** tài khoản của tôi đã được duyệt và đang ACTIVE.
- **When** tôi nhập email, mật khẩu đúng và chọn Đăng nhập.
- **Then** khi API xác thực thành công, giao diện chuyển đến dashboard và hiển thị chức năng theo vai trò do hệ thống trả về.

**AC02 — Thiếu thông tin hoặc sai thông tin đăng nhập**
- **Given** tôi đang ở màn hình đăng nhập.
- **When** tôi bỏ trống email/mật khẩu hoặc API báo thông tin đăng nhập không đúng.
- **Then** giao diện báo trường còn thiếu hoặc thông báo chung “Email hoặc mật khẩu không đúng”, không tiết lộ tài khoản có tồn tại hay không và không mở trang nội bộ.

**AC03 — Tài khoản chưa được duyệt hoặc bị khóa**
- **Given** tài khoản của tôi đang PENDING hoặc LOCKED.
- **When** tôi đăng nhập và API từ chối theo trạng thái tài khoản.
- **Then** giao diện hiển thị thông báo chờ duyệt hoặc tài khoản bị khóa tương ứng với phản hồi API; không tạo phiên đăng nhập thành công.

### US-UI03: Xem và cập nhật hồ sơ cá nhân

**As a** người đã đăng nhập,

**I want** xem hồ sơ và cập nhật tên hiển thị hoặc mật khẩu của mình,

**So that** thông tin cá nhân được chính xác và tôi có thể chủ động bảo vệ tài khoản.

**AC01 — Xem hồ sơ**
- **Given** tôi có phiên đăng nhập hợp lệ.
- **When** tôi mở Hồ sơ cá nhân.
- **Then** giao diện tải hồ sơ của chính tôi, hiển thị họ tên, email, vai trò và đơn vị nếu có; không hiển thị mật khẩu hay giá trị băm mật khẩu.

**AC02 — Lưu tên hiển thị**
- **Given** hồ sơ đã tải thành công và tôi sửa họ tên hợp lệ.
- **When** tôi chọn Lưu và API xác nhận cập nhật thành công.
- **Then** giao diện hiển thị tên mới và thông báo thành công; khi mở lại hồ sơ, tên được lấy từ dữ liệu đã lưu.

**AC03 — Đổi mật khẩu**
- **Given** tôi đang ở phần đổi mật khẩu của hồ sơ.
- **When** tôi nhập đúng mật khẩu hiện tại, mật khẩu mới đạt chính sách đã thống nhất và xác nhận trùng khớp rồi lưu.
- **Then** giao diện chỉ thông báo đổi mật khẩu thành công sau khi API xác nhận và xóa nội dung các ô mật khẩu sau thành công.

**AC04 — Dữ liệu sai hoặc trường không được phép sửa**
- **Given** tôi đang sửa hồ sơ.
- **When** tên bị để trống, mật khẩu hiện tại bị API từ chối, mật khẩu mới không hợp lệ hoặc xác nhận không khớp.
- **Then** giao diện báo lỗi phù hợp và không hiển thị cập nhật thành công. Email, vai trò, trạng thái và đơn vị ở chế độ chỉ xem, không có thao tác tự thay đổi trên trang này.

### US-UI04: Sử dụng dashboard theo quyền

**As a** người dùng nội bộ đã đăng nhập,

**I want** xem dashboard với menu và danh sách lô trong phạm vi được cấp,

**So that** tôi nhanh chóng đi đến công việc phù hợp với vai trò của mình.

**AC01 — Hiển thị theo vai trò và phạm vi dữ liệu**
- **Given** tôi có phiên hợp lệ và hồ sơ xác định được vai trò.
- **When** tôi mở dashboard và dữ liệu tải thành công.
- **Then** giao diện hiển thị tên người dùng, liên kết hồ sơ, đăng xuất và danh sách lô do API trả về trong phạm vi được phép; Farmer có thao tác tạo lô, Processor/Distributor có đường dẫn xử lý lô theo quyền, Admin có đường dẫn quản trị. Không hiển thị số liệu tổng quan chưa có dữ liệu API được thống nhất.

**AC02 — Chưa có lô hoặc tải dữ liệu thất bại**
- **Given** tôi đang mở dashboard.
- **When** API trả danh sách rỗng hoặc việc tải dữ liệu thất bại.
- **Then** giao diện phân biệt “Chưa có lô trong phạm vi của bạn” với lỗi tải dữ liệu; trường hợp lỗi có thao tác Thử lại và không trình bày lỗi như một danh sách rỗng thành công.

**AC03 — Truy cập ngoài quyền**
- **Given** tôi đăng nhập bằng vai trò không được phép dùng một chức năng.
- **When** tôi tìm chức năng đó trong menu hoặc truy cập trực tiếp đường dẫn và API từ chối.
- **Then** menu không hiển thị thao tác ngoài quyền; trang truy cập trực tiếp không hiển thị dữ liệu được bảo vệ và thông báo không có quyền hoặc không tìm thấy theo phản hồi API đã thống nhất. Việc ẩn menu không thay thế kiểm tra quyền tại backend.

### US-UI05: Tra cứu nguồn gốc bằng mã lô

**As a** người tiêu dùng,

**I want** nhập mã lô trên trang tra cứu công khai,

**So that** tôi có thể kiểm tra nguồn gốc sản phẩm khi không quét được QR.

**AC01 — Tra cứu thành công**
- **Given** tôi mở trang tra cứu mà không đăng nhập và có mã lô hợp lệ.
- **When** tôi nhập mã lô rồi chọn Tra cứu.
- **Then** giao diện bỏ khoảng trắng ở đầu/cuối mã, gửi tra cứu qua endpoint công khai và khi tìm thấy sẽ mở kết quả của đúng mã lô đó.

**AC02 — Mã trống hoặc không tìm thấy**
- **Given** tôi đang ở trang tra cứu.
- **When** tôi gửi mã chỉ gồm khoảng trắng hoặc API báo không tìm thấy mã đã nhập.
- **Then** với mã trống, giao diện yêu cầu nhập mã và không gửi yêu cầu; với mã không tìm thấy, giao diện hiển thị thông báo và cho nhập lại. Không giữ kết quả của lần tra cứu trước dưới mã vừa thất bại.

**AC03 — Mất kết nối**
- **Given** tôi đã nhập mã lô và chọn Tra cứu.
- **When** yêu cầu thất bại do kết nối hoặc lỗi hệ thống.
- **Then** giao diện báo không thể tải kết quả, giữ mã đã nhập và cho Thử lại; không kết luận mã lô không tồn tại.

### US-UI06: Xem kết quả truy xuất từ mã lô hoặc QR

**As a** người tiêu dùng,

**I want** xem thông tin nguồn gốc và timeline công khai khi nhập mã lô hoặc mở QR,

**So that** tôi biết sản phẩm đến từ đâu và đã đi qua những công đoạn nào.

**AC01 — Mở kết quả hợp lệ**
- **Given** tôi có mã lô tồn tại hoặc mở đường dẫn QR được backend xác nhận hợp lệ, không cần đăng nhập.
- **When** giao diện tải kết quả từ endpoint truy xuất công khai thành công.
- **Then** trang hiển thị mã lô, tên sản phẩm, xuất xứ, tên đơn vị và timeline từ cũ đến mới; mỗi sự kiện hiển thị loại, thời điểm, địa điểm và mô tả được phép công khai. Không gọi endpoint timeline nội bộ để thay thế endpoint công khai.

**AC02 — Bảo vệ dữ liệu nội bộ và hiển thị trên điện thoại**
- **Given** tôi xem kết quả hợp lệ trên màn hình điện thoại rộng 360 px.
- **When** trang hiển thị thông tin lô và timeline.
- **Then** thông tin lô nằm trước timeline, nội dung không gây cuộn ngang toàn trang; không hiển thị email, mã người dùng, mã người thực hiện, nhật ký audit hoặc thông tin tài khoản nội bộ.

**AC03 — QR không hợp lệ hoặc tài nguyên không tồn tại**
- **Given** tôi mở QR sai chữ ký, token không còn hợp lệ hoặc mã lô không tồn tại.
- **When** API truy xuất công khai trả kết quả không tìm thấy.
- **Then** giao diện hiển thị cùng thông báo “Không tìm thấy thông tin truy xuất hợp lệ”, không tiết lộ dữ liệu nội bộ và có liên kết về trang nhập mã lô.

**AC04 — Không tải được dữ liệu**
- **Given** tôi đang mở kết quả truy xuất.
- **When** API gặp lỗi hệ thống hoặc mất kết nối.
- **Then** giao diện hiển thị lỗi tải và thao tác Thử lại, không hiển thị dữ liệu mẫu như kết quả thật hoặc báo QR sai khi chưa xác minh được.

**AC05 — Quá giới hạn tra cứu**
- **Given** tôi đang tra cứu bằng mã lô hoặc mở kết quả từ QR.
- **When** API truy xuất công khai trả 429 do gửi quá nhiều yêu cầu.
- **Then** giao diện thông báo "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút", giữ mã lô đã nhập nếu có và cho Thử lại; không kết luận mã lô hoặc QR không tồn tại.

### US-UI07: Đăng xuất khỏi giao diện nội bộ

**As a** người đã đăng nhập,

**I want** đăng xuất khỏi phiên làm việc trên trình duyệt,

**So that** người dùng tiếp theo trên thiết bị không tiếp tục dùng phiên của tôi qua giao diện.

**AC01 — Đăng xuất thành công tại frontend**
- **Given** tôi đang đăng nhập trong ứng dụng.
- **When** tôi chọn Đăng xuất.
- **Then** ứng dụng xóa thông tin xác thực và dữ liệu nội bộ trong bộ nhớ/cache của phiên phía frontend, đưa tôi về trang đăng nhập và không tiếp tục gửi yêu cầu bằng phiên vừa xóa.

**AC02 — Quay lại trang được bảo vệ**
- **Given** tôi đã đăng xuất.
- **When** tôi nhấn Quay lại, tải lại trang hoặc mở trực tiếp đường dẫn dashboard/hồ sơ.
- **Then** ứng dụng yêu cầu đăng nhập, không hiển thị lại dữ liệu nội bộ từ cache của phiên đã kết thúc.

Phạm vi story này là kết thúc phiên tại frontend. Khả năng thu hồi JWT ở backend và kết thúc phiên trên thiết bị khác cần được thống nhất riêng, không xem là đã được đáp ứng bằng thao tác xóa phiên trên trình duyệt.

## 4. Tiêu chí giao diện dùng chung

1. Trong lúc tải hoặc gửi dữ liệu, hiển thị trạng thái đang xử lý; chặn gửi lặp cùng thao tác cho tới khi yêu cầu hoàn tất.
2. Lỗi nhập liệu đặt gần trường tương ứng; lỗi hệ thống có thông báo dễ hiểu và thao tác thử lại khi phù hợp. Không đưa stack trace hoặc thông tin kết nối lên giao diện.
3. Phiên thiếu/sai/hết hạn trên các trang nội bộ: xóa dữ liệu phiên không còn hợp lệ, thông báo và đưa về đăng nhập; không áp dụng yêu cầu đăng nhập cho trang truy xuất công khai.
4. Khi lưu thất bại, không báo thành công và giữ các trường không nhạy cảm để sửa/thử lại; không đưa mật khẩu vào URL hoặc thông báo lỗi.
5. Biểu mẫu có nhãn trường và nút rõ ràng, thao tác được bằng bàn phím; các màn hình trong phạm vi dùng được trên điện thoại rộng 360 px mà không cuộn ngang toàn trang.

## 5. Các điểm cần thống nhất trước khi triển khai

| Nội dung | Cơ sở hiện tại | Việc cần chốt |
| --- | --- | --- |
| Đăng ký và duyệt tài khoản | Ma trận quyền đề xuất chọn 3 vai trò nghiệp vụ, trạng thái PENDING, Admin gán đơn vị và kích hoạt | Xác nhận luồng, trường bắt buộc, chính sách mật khẩu và mã phản hồi; đăng ký chưa có trong OpenAPI |
| Hồ sơ | Ma trận quyền cho sửa tên và mật khẩu với mật khẩu cũ; các trường khác chỉ xem | Chốt request/response và cách xử lý phiên sau đổi mật khẩu; chưa có trong OpenAPI |
| Phạm vi lô | Bản nháp endpoint nói Farmer xem lô do mình tạo; ma trận quyền nói lô thuộc đơn vị | Backend/Auth chốt một quy tắc; frontend chỉ trình bày dữ liệu trong phạm vi được API cho phép |
| Mã lỗi ngoài phạm vi | Bản nháp endpoint dùng 403; ma trận quyền đề xuất 404 | Chốt mã lỗi; giao diện không hiển thị dữ liệu khi yêu cầu bị từ chối |
| Truy xuất công khai | ERD giới hạn trường công khai; bản nháp endpoint đề xuất hai đường dẫn `/trace` | Bổ sung contract công khai; trạng thái lô chưa nằm trong danh sách trường công khai của ERD nên chưa bắt buộc hiển thị |
| Trạng thái và sự kiện | ERD và bản nháp endpoint còn hai bộ tên | Nhóm chốt cùng UML/OpenAPI ở tuần 3; giao diện không tự suy diễn hoặc đổi tên trạng thái |
| Quét QR | Ghi chú wireframe dùng camera điện thoại mở liên kết QR | Quét bằng camera ngay trong website chưa thuộc tiêu chí bắt buộc của bản này |
| Đăng xuất | Chưa có endpoint logout/thu hồi token trong bản nháp API | Chốt cơ chế phiên; US-UI07 chỉ yêu cầu xử lý phiên ở frontend |

## 6. Kiểm tra và bàn giao

- Đủ 7 story có As a / I want / So that; mỗi story có tiêu chí thành công và lỗi hoặc giới hạn truy cập theo Given–When–Then.
- Có đủ 5 nhóm yêu cầu của task: đăng ký, đăng nhập, hồ sơ, dashboard, giao diện truy xuất.
- Đã phân biệt giao diện nội bộ cần đăng nhập với truy xuất công khai; các quy tắc chưa thống nhất được ghi ở mục 5.
- Dùng tài liệu này làm đầu vào cho wireframe tuần 3 và các ca kiểm thử giao diện sau khi nhóm chốt contract; chưa phải bằng chứng chức năng đã chạy hoặc test đã đạt.
- Hoài Bảo đã kiểm tra và đồng ý push tài liệu; gửi PR cho Lê Bá Khánh Bình review theo phân công. Các Issue tương ứng chỉ tạo sau khi thống nhất nội dung và phạm vi bàn giao.
