# Real-Time Messaging System — Core Scaffold (Phần lõi bắt buộc)

Đây là bản triển khai **phần lõi bắt buộc** theo `Project_Plan_Real_Time_Messaging_System_v4.docx`:

- **Backend**: Spring Boot 3 + Spring Security (JWT + Refresh Token, BCrypt) + Spring Data JPA
  + SQL Server + WebSocket/STOMP.
- **Frontend**: React 18 + Vite + React Router + @stomp/stompjs (SockJS).

Đã có: đăng ký/đăng nhập, duy trì phiên (refresh token), hồ sơ cá nhân, kết bạn,
chat 1-1 realtime (gửi/nhận, Sent/Seen, Reply, Thu hồi, lazy-load lịch sử 20 tin/lần,
typing indicator, online/offline), tạo & quản lý group chat cơ bản, gửi ảnh/tệp,
chặn người dùng, và khu vực Admin (dashboard + khóa/mở khóa tài khoản).

Các mục "Nên có" / "Nếu còn thời gian" trong bản kế hoạch (emoji reaction, notification
đẩy, group chat nâng cao, v.v.) **chưa** được triển khai ở bản này — nhắn để mình làm
tiếp khi cần.

### Marketplace

Marketplace có tại `/marketplace`: tìm kiếm và lọc tin đăng, xem sản phẩm, đăng/sửa/xóa
tin, lưu sản phẩm, theo dõi người bán, chia sẻ liên kết, nhắn tin trực tiếp và báo cáo.
Ảnh được tải lên nhiều tệp (tối đa 8 ảnh/tin); chỉ chủ tin mới được sửa, xóa hoặc đánh
dấu đã bán. Chưa tích hợp thanh toán hoặc vận chuyển.

---

## 1. Yêu cầu môi trường

- JDK 17+
- Maven 3.9+ (hoặc dùng `./mvnw` nếu bạn thêm wrapper)
- Node.js 18+ và npm
- Microsoft SQL Server (2019+) — cài trực tiếp, hoặc chạy nhanh qua Docker (xem mục 2)
- (Tùy chọn) Docker + Docker Compose, nếu muốn dựng SQL Server bằng 1 lệnh thay vì cài thủ công

> Kiểm tra gần nhất: frontend build bằng `npm run build`; backend compile và test bằng
> Maven. Vite hiện cảnh báo bundle JavaScript chính lớn hơn 500 kB.

## 2. Cơ sở dữ liệu (SQL Server)

**Cách A — Có sẵn SQL Server:** chỉ cần tạo 1 database rỗng (ví dụ `messaging_db`) rồi
chạy `backend/database/schema.sql` để tạo các bảng nền.
Muốn có dữ liệu mẫu để test ngay, chạy tiếp `backend/database/seed-data.sql` — script
này tạo sẵn 3 tài khoản (`admin` / `alice` / `bob`, mật khẩu đều là `Password123`),
1 quan hệ bạn bè đã accepted, và 1 cuộc trò chuyện có sẵn 2 tin nhắn giữa alice & bob.
Các bảng Marketplace được Hibernate tạo/cập nhật khi backend khởi động (`ddl-auto: update`).

**Cách B — Chưa có SQL Server:** dùng Docker để dựng nhanh:

```bash
cd backend
docker compose up -d              # chạy SQL Server 2022 ở localhost:1433, sa/YourPassword123
# đợi container healthy (vài chục giây), rồi chạy 2 script trên bằng sqlcmd, Azure Data
# Studio, DBeaver, hoặc bất kỳ client SQL Server nào bạn quen dùng, ví dụ:
docker exec -it messaging-sqlserver /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U sa -P YourPassword123 -i /dev/stdin < database/schema.sql
docker exec -it messaging-sqlserver /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U sa -P YourPassword123 -i /dev/stdin < database/seed-data.sql
```

**Lưu ý về `ddl-auto=update`:** `application.yml` hiện để Hibernate tự tạo/cập nhật
bảng khi backend khởi động, nên kể cả khi bạn *không* chạy `schema.sql` tay, backend
vẫn tự dựng đủ bảng ở lần chạy đầu. Nếu bạn đã chạy `schema.sql` tay và muốn Hibernate
không đụng vào cấu trúc bảng nữa, đổi `ddl-auto` thành `validate` (kiểm tra khớp, không
sửa) hoặc `none` trong `application.yml`.

## 3. Chạy Backend

```bash
cd backend

# Cấu hình kết nối SQL Server qua biến môi trường (hoặc sửa trực tiếp application.yml)
export DB_HOST=localhost
export DB_PORT=1433
export DB_NAME=messaging_db
export DB_USERNAME=sa
export DB_PASSWORD=YourPassword123
export JWT_SECRET=$(openssl rand -base64 48)     # secret dài, ngẫu nhiên cho JWT
export CORS_ORIGINS=http://localhost:5173

mvn spring-boot:run
```

- `spring.jpa.hibernate.ddl-auto=update` → Hibernate sẽ tự tạo bảng trong `messaging_db`
  khi chạy lần đầu (các bảng lõi và bảng mạng xã hội/nhóm).
- Backend chạy ở `http://localhost:8080`.
- Khi cần tài khoản Admin đầu tiên: đăng ký một user bình thường qua `/api/auth/register`,
  sau đó vào SQL Server đổi cột `role` của user đó thành `ADMIN` (chưa có endpoint tạo
  admin, vì đây không nên public).

## 4. Chạy Frontend

```bash
cd frontend
npm install
cp .env.example .env      # chỉnh VITE_API_BASE_URL nếu backend không ở localhost:8080
npm run dev
```

- Mở `http://localhost:5173`.
- `vite.config.js` đã có sẵn proxy `/api` và `/ws` sang `http://localhost:8080` khi chạy
  dev, nên bạn cũng có thể để `VITE_API_BASE_URL` trống nếu chạy đúng 2 cổng mặc định.

## 5. Cấu trúc thư mục chính

```
backend/
  src/main/java/com/example/messaging/
    entity/          JPA entities theo các bảng nghiệp vụ
    repository/      Spring Data JPA repositories
    security/        JwtUtil, JwtAuthenticationFilter, @CurrentUser, UserDetailsService
    dto/             request/response DTO theo từng module (auth/user/friend/chat/admin)
    service/         nghiệp vụ chính (Auth, User, Friend, Conversation, Message, Admin...)
    controller/      REST endpoints
    websocket/       cấu hình STOMP + xác thực JWT khi CONNECT + xử lý realtime
    exception/       xử lý lỗi tập trung
    config/          Spring Security, CORS, static file serving cho /uploads

frontend/
  src/
    api/             axios client (tự refresh token khi 401) + các module gọi API
    context/         AuthContext, SocketContext (kết nối STOMP dùng chung toàn app)
    components/      Sidebar, Avatar, ProtectedRoute
    pages/           Login, Register, ChatWindow, FriendsPage, ProfilePage, AdminDashboard
```

## 6. Luồng nghiệp vụ chính đã triển khai (đối chiếu bản kế hoạch mục 7)

1. Đăng ký/Đăng nhập → nhận Access Token (JWT, 15p) + Refresh Token (7 ngày, lưu DB,
   thu hồi được).
2. Tìm bạn → gửi lời mời kết bạn → bên kia chấp nhận → tự động tạo cuộc trò chuyện
   PRIVATE dùng chung cho 2 người (không tạo trùng).
3. Gửi tin nhắn qua WebSocket (`/app/chat.send`) → lưu SQL Server → broadcast realtime
   tới `/topic/conversation/{id}` cho mọi client đang mở cuộc trò chuyện đó.
4. Trạng thái Sent/Seen theo từng người nhận (bảng MESSAGE_STATUS); khi người nhận mở
   cuộc trò chuyện, client gọi `/app/chat.seen` → server cập nhật + báo lại cho người
   gửi để đổi UI "Đã gửi" → "Đã xem".
5. Lịch sử tin nhắn tải dần (lazy loading) 20 tin/lần qua REST
   `GET /api/messages/conversation/{id}?page=n`.
6. Admin: đăng nhập cùng cơ chế JWT nhưng chỉ tài khoản `role=ADMIN` mới gọi được
   `/api/admin/**` (chặn ở `SecurityConfig`), xem dashboard tổng quan + khóa/mở khóa
   tài khoản.

## 7. Groups

Nhóm mạng xã hội dùng chung `USERS`, JWT, bạn bè và bộ lưu tệp hiện có; dữ liệu bài viết
được tách khỏi `SOCIAL_POST` để kiểm soát riêng tư. Route giao diện: `/groups` và
`/groups/{groupId}`. Backend đặt dưới `controller/GroupController`, `service/GroupService`,
`entity/Group*` và `repository/Group*`.

- Chủ nhóm được cấp role `OWNER`; các role hỗ trợ: `ADMIN`, `MODERATOR`, `MEMBER`.
- Có nhóm công khai/riêng tư, join request, invitation cho bạn bè đã kết nối, quản lý
  thành viên, bài viết/media, reaction, comment/reply, ghim, tìm kiếm/sắp xếp, poll và event.
- Khu vực quản trị gồm duyệt thành viên/bài viết, báo cáo, cảnh cáo, xóa/cấm/bỏ cấm,
  phân quyền, bộ lọc từ khóa và cài đặt ảnh nhóm.
- Các endpoint Groups yêu cầu JWT; backend kiểm tra membership/role cho nội dung riêng tư
  và hành động quản trị. Giới hạn mặc định là 5 bài hoặc poll và 20 bình luận/phút/người/nhóm.
- `ddl-auto=update` tự tạo các bảng khi chạy ứng dụng. Nếu quản lý schema thủ công, chạy
  `backend/database/migrations/20261004_add_social_groups.sql` rồi
  `backend/database/migrations/20261005_add_group_events_polls.sql` trên `messaging_db`.

## 8. Việc cần làm tiếp (theo đúng bảng ưu tiên trong bản kế hoạch)

- **Nên có**: group chat nâng cao (đổi vai trò thành viên, xóa nhóm), push notification khi offline,
  push notification khi offline, tìm kiếm tin nhắn trong hội thoại.
- **Nếu còn thời gian**: giao diện dark mode, thống kê chi tiết hơn cho Admin, i18n.
- Viết test (JUnit cho service layer, React Testing Library cho frontend) — hiện chưa có.
- Thêm CI (GitHub Actions) build + test tự động.
