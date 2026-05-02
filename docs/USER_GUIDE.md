# Hướng Dẫn Sử Dụng Ứng Dụng Maika

Tài liệu này dành cho người dùng cuối của hệ thống Maika: ban giám hiệu, giáo viên và phụ huynh.

## 1. Đăng Nhập

### Ban giám hiệu / Admin

1. Mở trang đăng nhập hệ thống, nhấn **Admin / Giáo viên** trên thanh điều hướng.
2. Nhập email quản trị và mật khẩu được cấp.
3. Sau khi đăng nhập, hệ thống chuyển đến trang quản trị.

### Giáo viên

1. Mở cổng giáo viên bằng nút **Admin / Giáo viên** trên trang chủ.
2. Nhập email và mật khẩu được cấp.
3. Sau khi đăng nhập, giáo viên chỉ thấy dữ liệu thuộc cơ sở được phân công.

### Phụ huynh

1. Nhấn **Phụ huynh đăng nhập** trên thanh điều hướng của trang chủ.
2. Nhập email và mật khẩu được nhà trường cấp.
3. Nếu có nhiều bé được liên kết với cùng một tài khoản, chọn bé cần xem trong thanh đầu trang.

## 2. Chức Năng Cho Admin

### Tổng Quan (Dashboard)

Xem nhanh số học sinh, giáo viên, tình hình điểm danh, thông báo và các chỉ số vận hành chính. Dashboard cập nhật theo thời gian thực.

### Học Sinh

Admin có thể:

- Xem danh sách học sinh, lọc theo cơ sở và lớp.
- Thêm hoặc cập nhật hồ sơ học sinh.
- Ghi nhận lớp, cơ sở, phụ huynh và trạng thái học.

### Giáo Viên

Quản lý danh sách giáo viên, thông tin liên hệ và phân công theo cơ sở.

### Điểm Danh

Theo dõi chuyên cần theo ngày, bao gồm có mặt, đi trễ, vắng mặt, giờ đón và ghi chú. Dữ liệu điểm danh được giữ lại để tra cứu lịch sử.

### Nhật Ký Ngày

Xem nhật ký do giáo viên ghi hằng ngày: bữa ăn, giấc ngủ, hoạt động và ghi chú riêng cho từng học sinh. Phụ huynh thấy nhật ký qua cổng phụ huynh sau khi giáo viên lưu.

### Sức Khỏe

Lưu thông tin dị ứng, thuốc, ghi chú y tế, bác sĩ và liên hệ khẩn cấp của từng học sinh.

### Sự Cố

Ghi nhận sự cố, mức độ, cách xử lý ban đầu và trạng thái xác nhận từ phụ huynh. Phụ huynh nhận thông báo ngay khi có sự cố mới.

### Học Phí / Hóa Đơn

Tạo và theo dõi hóa đơn, hạn thanh toán, trạng thái đã thanh toán hoặc quá hạn. Có thể gửi thông báo nhắc thanh toán qua Zalo ZNS nếu đã cấu hình.

### Thông Báo

Tạo thông báo gửi cho phụ huynh theo vai trò, lớp, học sinh hoặc toàn trường. Thông báo hiển thị trong cổng phụ huynh và có thể gửi push notification về trình duyệt nếu phụ huynh đã bật quyền thông báo.

### Thực Đơn

Lập thực đơn theo tuần, nhập món ăn, nguyên liệu, ghi chú dị ứng và xuất bản cho phụ huynh xem.

### Thư Viện Ảnh

Tạo album, tải ảnh hoạt động, duyệt trạng thái và xuất bản ảnh cho phụ huynh xem.

Ảnh chưa duyệt sẽ không hiển thị với phụ huynh. Admin duyệt ảnh trước khi xuất bản. Ảnh không còn cần hiển thị có thể chuyển sang trạng thái lưu trữ. Admin có thể tải ảnh lưu trữ về máy và xóa khỏi hệ thống trong mục **Lưu trữ**.

### Tài Khoản

Quản lý vai trò, trạng thái hoạt động, cơ sở của giáo viên và liên kết phụ huynh với học sinh.

Khi tạo tài khoản mới, nhập email, mật khẩu tạm thời, vai trò và thông tin liên kết cần thiết. Giáo viên cần được gán cơ sở; phụ huynh cần được liên kết với học sinh.

Quy tắc tài khoản đăng nhập:

- Mỗi email chỉ tạo được một tài khoản trong toàn hệ thống.
- Email là định danh đăng nhập và cần có dạng `ten@mien.xxx`. Nếu nhà trường chưa có domain riêng, dùng email thật của người dùng hoặc một quy ước nội bộ thống nhất.
- Giáo viên được phân cơ sở trực tiếp. Giáo viên chỉ thấy dữ liệu của cơ sở được gán.
- Phụ huynh được phân cơ sở thông qua học sinh được liên kết. Khi đang chọn CS1 hoặc CS2, danh sách phụ huynh chỉ hiện các tài khoản có con thuộc cơ sở đó.
- Phụ huynh phải được liên kết với học sinh trước khi lưu tài khoản. Nếu chưa thấy học sinh trong danh sách chọn, hãy kiểm tra lại bộ lọc cơ sở hoặc hồ sơ học sinh.
- Mật khẩu tạm thời khi tạo mới cần tối thiểu 8 ký tự. Khi chỉnh sửa, để trống ô mật khẩu nếu không muốn đổi mật khẩu.
- Khóa tài khoản sẽ chặn đăng nhập nhưng không xóa hồ sơ. Xóa tài khoản sẽ xóa quyền đăng nhập khỏi hệ thống.

### Lưu Trữ

Theo dõi dung lượng ảnh, tải ảnh lưu trữ về máy và xóa khỏi hệ thống khi không còn cần dùng trực tuyến.

### Cấu Hình Hệ Thống

Xem **Cấu hình → Hệ thống** để:

- Cập nhật thông tin trường (tên, địa chỉ, giờ mở cửa, email liên hệ).
- Cấu hình tài khoản ngân hàng nhận học phí.
- Quản lý năm học, ngày nghỉ lễ và mức học phí.
- Cài đặt Zalo Official Account (ZNS) để gửi thông báo tự động.
- Xem hướng dẫn sử dụng hệ thống (tài liệu này).

## 3. Chức Năng Cho Giáo Viên

Giáo viên sử dụng cổng giáo viên cho công việc hằng ngày:

- **Điểm danh**: Ghi có mặt, đi trễ, vắng mặt và giờ đón cho từng học sinh trong cơ sở được phân công.
- **Nhật ký ngày**: Ghi bữa ăn, giấc ngủ, hoạt động và ghi chú cho từng học sinh. Phụ huynh thấy nhật ký sau khi lưu.
- **Thư viện ảnh**: Tải ảnh hoạt động lên để admin duyệt và xuất bản.

Giáo viên không xem được dữ liệu học sinh ngoài cơ sở của mình.

## 4. Chức Năng Cho Phụ Huynh

Phụ huynh có thể xem các mục sau cho bé được liên kết:

- Tổng quan hồ sơ học sinh.
- Điểm danh và tình hình chuyên cần.
- Nhật ký ngày (bữa ăn, giấc ngủ, hoạt động).
- Thông báo từ nhà trường.
- Thực đơn đã xuất bản.
- Hình ảnh hoạt động đã được duyệt.
- Hồ sơ sức khỏe.
- Báo cáo sự cố liên quan đến bé.
- Hóa đơn và trạng thái học phí.
- Thiết lập quyền riêng tư, bao gồm đồng ý hình ảnh và kênh nhận thông tin.

### Push Notification (Thông Báo Trình Duyệt)

Phụ huynh có thể bật thông báo đẩy (push notification) để nhận thông báo ngay trên điện thoại hoặc máy tính khi nhà trường gửi thông báo mới, có sự cố hoặc hóa đơn mới. Để bật:

1. Đăng nhập cổng phụ huynh.
2. Vào mục **Cài đặt** hoặc khi được hỏi tự động, chọn **Cho phép thông báo**.
3. Trình duyệt sẽ hỏi xác nhận — nhấn **Cho phép**.

## 5. Zalo ZNS

Nếu nhà trường đã cấu hình Zalo Official Account, phụ huynh có thể nhận thông báo học phí và sự cố qua Zalo. Không cần cài ứng dụng thêm — tin nhắn đến thẳng Zalo của phụ huynh.

## 6. Lưu Ý Khi Sử Dụng

- Không chia sẻ tài khoản cho người khác.
- Đăng xuất sau khi dùng trên thiết bị công cộng.
- Báo ngay cho nhà trường nếu thông tin học sinh, phụ huynh hoặc số điện thoại chưa chính xác.
- Với dữ liệu sức khỏe hoặc sự cố, chỉ nhập thông tin cần thiết và kiểm tra kỹ trước khi lưu.
- Ảnh trẻ chỉ nên được xuất bản khi đã phù hợp với quyền đồng ý của phụ huynh.

## 7. Khi Cần Hỗ Trợ

Liên hệ bộ phận quản trị hệ thống của nhà trường nếu:

- Không đăng nhập được.
- Tài khoản chưa thấy đúng học sinh hoặc đúng cơ sở.
- Dữ liệu điểm danh, học phí, sức khỏe hoặc thông báo bị thiếu.
- Cần khóa tài khoản, cấp lại mật khẩu hoặc thay đổi người phụ trách.
- Push notification hoặc Zalo không nhận được tin — kiểm tra quyền thông báo trình duyệt và cài đặt Zalo OA.
