# CMC Talk

CMC Talk là ứng dụng mạng xã hội và nhắn tin realtime dành cho sinh viên. Dự án gồm
backend Spring Boot, frontend React và cơ sở dữ liệu Microsoft SQL Server.

## Tính năng

- Đăng ký bằng email sinh viên `@st.cmcu.edu.vn`, xác thực mã email, đăng nhập bằng
  username hoặc email, đổi mật khẩu và duy trì phiên bằng access/refresh token.
- Hồ sơ cá nhân, tìm kiếm người dùng, kết bạn, chặn người dùng và tin nhắn chờ.
- Chat cá nhân và nhóm: nhắn tin realtime, trạng thái đã xem, typing indicator, chỉnh
  sửa/thu hồi tin nhắn, reaction, tệp đính kèm và gọi thoại/video.
- Bảng tin: bài viết, reaction, bình luận, chia sẻ và story.
- Nhóm cộng đồng: thành viên, bài viết/media, kiểm duyệt, báo cáo, poll, sự kiện và lời mời.
- Sự kiện, video, nội dung đã lưu và thông báo trong ứng dụng.
- Khu vực Admin để xem dashboard và khóa/mở khóa tài khoản.
- Forum hiện mới là giao diện minh họa; API, dữ liệu và lưu trữ Forum chưa được kết nối.

## Công nghệ và yêu cầu

- Java 17+, Maven 3.9+
- Node.js 18+, npm
- Microsoft SQL Server 2019+
- (Tùy chọn) Docker và Docker Compose để chạy SQL Server cục bộ

Backend dùng Spring Boot 3.3, Spring Security, Spring Data JPA, JWT, WebSocket/STOMP
và SQL Server. Frontend dùng React 18, Vite, React Router, Axios và STOMP/SockJS.

## Chạy ứng dụng tại máy

### 1. Khởi tạo cơ sở dữ liệu

Có thể dùng SQL Server đã cài sẵn hoặc chạy bản SQL Server 2022 dành cho phát triển:

```powershell
cd backend
docker compose up -d
```

Kết nối tới SQL Server tại `localhost:1433` bằng Azure Data Studio, SQL Server
Management Studio hoặc công cụ tương đương. Thông tin mặc định của container trong
`docker-compose.yml` là user `sa` và password `YourPassword123`.

Chạy `backend/database/schema.sql` trên một cơ sở dữ liệu mới. **Script này xóa và tạo
lại các bảng được khai báo trong file; chỉ chạy trên database rỗng hoặc khi đã sao lưu
và chủ động chấp nhận mất dữ liệu.** Backend dùng `ddl-auto=update` để cập nhật/tạo các
bảng còn thiếu khi khởi động.

Để nạp dữ liệu demo, chạy `backend/database/seed-data.sql` sau khi tạo schema. Tài khoản
mẫu đều dùng mật khẩu `Password123`:

| Username | Vai trò |
|---|---|
| `admin` | ADMIN |
| `alice` | USER |
| `bob` | USER |

Đây chỉ là tài khoản thử nghiệm; không dùng các thông tin này trong môi trường thật.

### 2. Cấu hình và chạy backend

Trong PowerShell:

```powershell
cd backend
$env:DB_HOST = "localhost"
$env:DB_PORT = "1433"
$env:DB_NAME = "messaging_db"
$env:DB_USERNAME = "sa"
$env:DB_PASSWORD = "YourPassword123"
$env:JWT_SECRET = "<chuỗi bí mật ngẫu nhiên, tối thiểu 32 ký tự>"
mvn spring-boot:run
```

Backend chạy tại `http://localhost:8080`. Có thể cấu hình các biến môi trường trong
`backend/application-local.yml` thay vì đặt trong terminal; file này được Git bỏ qua.
Xem `backend/application-local.example.yml` để cấu hình SMTP.

Mặc định, nếu chưa cấu hình `MAIL_USERNAME` và `MAIL_PASSWORD`, mã xác thực đăng ký
được ghi vào log backend để thử nghiệm tại máy. Muốn gửi email thật, cấu hình tài khoản
SMTP (với Gmail cần App Password) rồi khởi động lại backend. Access token mặc định có
hiệu lực 24 giờ, refresh token 30 ngày.

### 3. Cài và chạy frontend

Mở terminal thứ hai:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
npm run dev
```

Mở `http://localhost:5173`. Khi chạy với cấu hình mặc định, Vite chuyển tiếp `/api`,
`/ws` và `/uploads` tới backend tại `localhost:8080`. Chỉ đặt `VITE_API_BASE_URL` trong
`.env` nếu backend chạy ở địa chỉ khác.

Để thử gọi thoại/video trên thiết bị khác trong cùng mạng LAN, đặt `VITE_HTTPS=true`
trong `frontend/.env`, khởi động lại Vite và mở ứng dụng bằng HTTPS. Trình duyệt yêu cầu
secure context để cấp quyền camera/microphone; kết nối ngang hàng còn phụ thuộc vào
firewall và cấu hình mạng.

## Cấu trúc dự án

```text
backend/
  database/                 Schema, dữ liệu mẫu và migration SQL
  src/main/java/.../
    controller/             REST API
    service/                Nghiệp vụ ứng dụng
    entity/, repository/    Mô hình và truy cập dữ liệu
    security/               JWT và xác thực người dùng
    websocket/              STOMP chat và signaling cuộc gọi
  src/main/resources/       Cấu hình Spring và SQL khởi tạo/cập nhật
frontend/
  src/api/                  Các module gọi REST API
  src/context/              Trạng thái đăng nhập và kết nối realtime
  src/components/           Thành phần giao diện dùng chung
  src/pages/                Các trang ứng dụng
```

## Realtime chat

Frontend kết nối SockJS/STOMP tới `/ws` và xác thực bằng access token. Client gửi các
thao tác chat tới `/app` (ví dụ `/app/chat.send`) và nhận sự kiện theo hội thoại tại
`/topic/conversation/{conversationId}`. Lịch sử được tải qua REST
`GET /api/messages/conversation/{conversationId}?page=0`; mỗi trang gồm 20 tin nhắn,
trong đó `page=0` là trang mới nhất.

## Lệnh kiểm tra

```powershell
# Từ thư mục backend
mvn test

# Từ thư mục frontend
npm run build
```

## Lưu ý triển khai

- Thay `JWT_SECRET`, thông tin SQL Server và SMTP bằng giá trị riêng, an toàn; không
  dùng mật khẩu mặc định của Docker hoặc tài khoản demo trong production.
- Cấu hình CORS, HTTPS, lưu trữ upload và các giới hạn truy cập phù hợp trước khi
  công khai ứng dụng. Cấu hình CORS hiện tại trong backend cho phép origin rộng rãi,
  phù hợp phát triển nhưng không nên giữ nguyên khi triển khai thật.
- Tệp tải lên được lưu cục bộ theo `app.upload.dir` (mặc định `./uploads`); hãy cấu hình
  backup và quyền truy cập cho thư mục này nếu cần giữ dữ liệu.
