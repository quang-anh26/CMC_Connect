# CMC Talk

CMC Talk là ứng dụng mạng xã hội và nhắn tin realtime dành cho sinh viên. Dự án gồm
backend Spring Boot, frontend React và cơ sở dữ liệu PostgreSQL.

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
- PostgreSQL 16+
- (Tùy chọn) Docker và Docker Compose để chạy PostgreSQL cục bộ

Backend dùng Spring Boot 3.3, Spring Security, Spring Data JPA, JWT, WebSocket/STOMP
và PostgreSQL. Frontend dùng React 18, Vite, React Router, Axios và STOMP/SockJS.

## Chạy ứng dụng tại máy

### 1. Khởi tạo PostgreSQL

Chạy PostgreSQL 16 dành cho phát triển:

```powershell
cd backend
docker compose up -d postgres
```

Container mở PostgreSQL tại `localhost:5432` với database `messaging_db`, user
`messaging_app` và mật khẩu dành riêng cho phát triển `messaging_dev_password`.
Nếu `backend/.env` đặt `POSTGRES_HOST_PORT`, PostgreSQL sẽ dùng cổng đó trên máy host
(backend trong Docker Compose vẫn kết nối qua cổng nội bộ `5432`).
Hibernate tự tạo/cập nhật bảng khi backend khởi động. Các file SQL trong
`backend/database/` và `src/main/resources/db/migration/` là script T-SQL cũ cho SQL
Server; không chạy chúng với PostgreSQL. Database mới không có tài khoản demo cho tới
khi người dùng đăng ký hoặc dữ liệu được nạp riêng.

### 2. Cấu hình và chạy backend

Trong PowerShell:

```powershell
cd backend
$env:DB_HOST = "localhost"
$env:DB_PORT = "5432"
$env:DB_NAME = "messaging_db"
$env:DB_USERNAME = "messaging_app"
$env:DB_PASSWORD = "messaging_dev_password"
$env:DB_SSL_MODE = "disable"
$env:JWT_SECRET = "<chuỗi bí mật ngẫu nhiên, tối thiểu 32 ký tự>"
mvn spring-boot:run
```

Backend chạy tại `http://localhost:8080`. Có thể cấu hình các biến môi trường trong
`backend/application-local.yml` thay vì đặt trong terminal; file này được Git bỏ qua.
SMTP được cấu hình bằng các biến `MAIL_USERNAME`, `MAIL_PASSWORD` và `MAIL_FROM`.

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

### Chạy cả hệ thống bằng Docker Compose

Thay cho các bước chạy backend và frontend riêng lẻ ở trên:

```powershell
cd backend
docker compose up --build -d
```

Mở `http://localhost:5173`. Compose khởi chạy PostgreSQL, Spring Boot và Vite; dữ liệu
PostgreSQL được giữ trong volume `postgres-data`. Các biến SMTP cho container có thể đặt
trong `backend/.env` (`MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM`); file này bị Git bỏ
qua, không commit thông tin bí mật. `application-local.yml` chỉ được tự nạp khi chạy
backend trực tiếp trên máy, không được đóng gói vào container.

Để thử gọi thoại/video trên thiết bị khác trong cùng mạng LAN, đặt `VITE_HTTPS=true`
trong `frontend/.env`, khởi động lại Vite và mở ứng dụng bằng HTTPS. Trình duyệt yêu cầu
secure context để cấp quyền camera/microphone; kết nối ngang hàng còn phụ thuộc vào
firewall và cấu hình mạng.

## Cấu trúc dự án

```text
backend/
  database/                 Script SQL Server cũ (không dùng cho PostgreSQL)
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

- Thay `JWT_SECRET`, thông tin PostgreSQL và SMTP bằng giá trị riêng, an toàn; không
  dùng mật khẩu mặc định của Docker trong production.
- Đặt `CORS_ORIGINS` bằng origin frontend production. Cả REST API lẫn WebSocket đều
  dùng danh sách này; không đặt wildcard khi công khai ứng dụng.
- Tệp tải lên được lưu cục bộ theo `app.upload.dir` (mặc định `./uploads`); hãy cấu hình
  ổ đĩa bền vững hoặc object storage và backup nếu cần giữ dữ liệu.

## Đóng gói backend để triển khai cloud

`backend/Dockerfile` đóng gói Spring Boot bằng Java 17. Khi chạy container, cấu hình
các biến môi trường sau trong dịch vụ host (không commit thông tin bí mật):

| Biến | Giá trị |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME` | Địa chỉ và tên database PostgreSQL trên cloud |
| `DB_USERNAME`, `DB_PASSWORD` | Tài khoản database |
| `DB_SSL_MODE` | Đặt `require` cho database cloud có TLS |
| `JWT_SECRET` | Chuỗi ngẫu nhiên bí mật, tối thiểu 32 ký tự |
| `CORS_ORIGINS` | Origin frontend, ví dụ `https://frontend-bay-one-75.vercel.app` |
| `UPLOAD_DIR` | Thư mục upload tạm của backend; không bền vững trên Render Free |
| `MAIL_USERNAME`, `MAIL_PASSWORD` | SMTP credentials để gửi mã xác thực email |
| `MAIL_FROM` | Địa chỉ gửi email (tùy chọn) |

Backend cần PostgreSQL tương thích và hỗ trợ WebSocket/STOMP. Render Free dùng ổ đĩa
tạm thời nên ảnh, video và file tải lên có thể mất sau khi service restart hoặc deploy.
Supabase Storage chưa được nối vào backend; trước khi dùng app lâu dài cần triển khai phần
lưu file này. Nếu không cấu hình SMTP, mã xác thực chỉ xuất hiện trong log backend và
người dùng không thể tự nhận mã qua email. Gói miễn phí có thể ngủ, tạm dừng project ít
hoạt động và giới hạn tài nguyên.
