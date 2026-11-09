# Báo cáo phân tích dự án hiện tại FMESS-CMCU

**Ngày phân tích:** 02-11-2026  
**Phạm vi:** Đọc mã nguồn và cấu hình hiện có trong repository `BTL_CNPhanMem`; không sửa mã nguồn, cấu hình hay database; không chạy migration.  
**Nguyên tắc:** BTL_CNPhanMem là nền tảng chính thức. Báo cáo không giả định kiến trúc hoặc tính năng từ một dự án Forum độc lập.

> **Giới hạn bằng chứng:** Các kết luận dưới đây dựa trên source, manifest, cấu hình và script SQL có trong repository. Không kết nối SQL Server để xác nhận trạng thái database đang chạy. Repository không có module Forum độc lập hay tài liệu Forum tham khảo để đối chiếu. “Có triển khai” nghĩa là có code/API và, khi nêu giao diện, có route/page tương ứng; không phải cam kết đã kiểm thử đầy đủ trên môi trường triển khai.

## 1. Tổng quan kiến trúc

Đây là ứng dụng web đơn repository, frontend và backend tách theo thư mục:

- **Backend:** ứng dụng Spring Boot dạng monolith, các module nghiệp vụ cùng một process và cùng cấu hình persistence.
- **Frontend:** ứng dụng SPA React/Vite; REST gọi backend qua Axios; chức năng chat, presence và báo hiệu cuộc gọi dùng WebSocket/STOMP.
- **Database:** source khai báo Microsoft SQL Server với Spring Data JPA/Hibernate. Compose chỉ định container SQL Server 2022 cho môi trường phát triển.
- **Upload:** file được lưu trên filesystem của máy chạy backend; một số URL được phục vụ qua HTTP. Chưa thấy cấu hình dịch vụ object storage/cloud trong source.

### Luồng request chính

1. Người dùng thao tác trong React Router page/component.
2. Các module trong `frontend/src/api/` gọi Axios client. Client đính kèm access JWT và thử refresh token khi gặp lỗi xác thực.
3. Spring Security xác minh JWT, sau đó Controller nhận `@CurrentUser` và chuyển tiếp đến Service.
4. Service thực hiện nghiệp vụ, dùng Spring Data Repository và JPA Entity trên SQL Server.
5. Backend trả DTO/JSON; các sự kiện chat realtime đi qua STOMP/WebSocket.

## 2. Công nghệ và phiên bản

| Thành phần | Bằng chứng trong dự án / môi trường đọc |
|---|---|
| Java | Maven compiler target `17` trong [`backend/pom.xml`](../backend/pom.xml); JDK cài trên môi trường phân tích là `21.0.12.1`. |
| Spring Boot | Parent version `3.3.4`. |
| Persistence | Spring Data JPA, Hibernate, SQL Server dialect. |
| SQL Server driver | `com.microsoft.sqlserver:mssql-jdbc` (runtime scope; version do Spring Boot dependency management quản lý). |
| Build backend | Maven hiện cài `3.10.0`; README yêu cầu Maven `3.9+`. |
| Frontend | React và React DOM `^18.3.1`; React Router DOM `^6.26.2`. |
| Frontend tooling | Vite `^5.4.8`, plugin React `^4.3.1`; JavaScript ES modules, JSX. |
| HTTP và realtime | Axios `^1.7.7`; `@stomp/stompjs` `^7.0.0`, SockJS `^1.6.1`. |
| Node/npm trên môi trường phân tích | Node `v24.21.0`, npm `11.19.0`; README nêu Node `18+`. `package.json` không khai báo `engines`. |
| Kiểm thử | JUnit 5/Spring Boot Test/Mockito ở backend. Frontend không có script test trong `package.json`. |

Frontend hiện không khai báo TypeScript, Redux hay một thư viện quản lý trạng thái tập trung. Trạng thái chủ yếu nằm trong React Context và state của từng page/component.

## 3. Sơ đồ cấu trúc thư mục

```text
BTL_CNPhanMem/
├── backend/
│   ├── database/                  # schema.sql, seed-data.sql, migration SQL thủ công
│   ├── src/main/java/com/example/messaging/
│   │   ├── config/                # Spring Security, CORS/static/upload config
│   │   ├── controller/            # REST API
│   │   ├── dto/                   # request/response DTO theo module
│   │   ├── entity/                # JPA entities và enums
│   │   ├── exception/             # ApiException, global handler
│   │   ├── repository/            # Spring Data JPA
│   │   ├── security/              # JWT, current user, user details
│   │   ├── service/               # nghiệp vụ
│   │   ├── util/                  # policy/helper
│   │   └── websocket/             # STOMP auth, controller, presence
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   └── db/migration/          # các script ensure-*.sql được cấu hình khởi động
│   ├── src/test/java/             # hiện có 3 lớp test
│   ├── uploads/                   # dữ liệu file local hiện hữu
│   ├── application-local.example.yml
│   ├── application-local.yml      # file cấu hình local hiện có, bị gitignore
│   ├── docker-compose.yml         # SQL Server
│   └── pom.xml
├── frontend/
│   ├── src/
│   │   ├── api/                   # Axios client và API modules
│   │   ├── components/            # UI dùng chung
│   │   ├── context/               # AuthContext, SocketContext
│   │   ├── pages/                 # page theo route/module
│   │   ├── styles/                # CSS theo feature và design tokens
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   ├── .env.example
│   ├── package.json
│   └── vite.config.js
├── uploads/                       # tệp local chưa được Git theo dõi
└── README.md
```

## 4. Chức năng hiện có và trạng thái theo source

| Nhóm | Trạng thái trong code |
|---|---|
| Đăng ký/đăng nhập | Có API gửi/kiểm tra mã email, đăng ký, đăng nhập, refresh và logout. Quy tắc đăng ký kiểm tra email sinh viên đuôi `@st.cmcu.edu.vn`. |
| Hồ sơ | Có xem hồ sơ bản thân/người dùng, cập nhật profile, đổi mật khẩu, avatar, ảnh bìa và tìm kiếm user. |
| Feed/bài đăng | Có danh sách/tạo bài viết, cập nhật privacy, xóa, like/reaction, comment/reply và share. `SocialPost` hỗ trợ bài share và nội dung privacy. Không thấy endpoint tìm kiếm chung cho feed; có tìm kiếm riêng ở các module khác. |
| Lưu nội dung | Có API lưu/bỏ lưu, trạng thái đã lưu và collection; model lưu theo loại nội dung. Có page `/saved`. |
| Bạn bè | Có gửi/nhận lời mời, chấp nhận/từ chối và liệt kê bạn đã kết nối. Không thấy API riêng để hủy kết bạn trong `FriendController`. |
| Chat | Có hội thoại riêng/nhóm, thành viên, lịch sử phân trang, gửi/sửa/thu hồi tin, reply, reaction, trạng thái đã xem, typing và upload attachment. REST bổ sung các thao tác; chat realtime qua STOMP. |
| Cuộc gọi | Có giao diện và signaling WebRTC trong `CallOverlay`/`ChatWebSocketController`; README mô tả cuộc gọi voice/video dùng STUN. Đây là signaling/peer-to-peer client, không phải media server được tìm thấy trong source. |
| Nhóm xã hội | Có tạo/sửa/xóa nhóm, công khai/riêng tư, join/leave, thành viên, bài viết/media, comment/reaction, poll, event, pin, invite, duyệt nội dung, report và quản lý thành viên. Quyền truy cập nhóm được xử lý trong service. |
| Story | Có API list/create/delete và page/feed liên quan. |
| Event | Có danh sách/chi tiết, tạo/sửa/xóa và cập nhật trạng thái tham gia. |
| Video | Có API/page upload, tạo/sửa/xóa, feed/search-filter, xem/media, view count, save, follow và report. |
| Notification | Có API/page xem, đếm chưa đọc, đánh dấu đọc và xóa; có notification cho nhóm. Code thể hiện notification trong ứng dụng, không thấy Web Push service. |
| Chặn user | Có block/unblock và kiểm tra quyền gửi tin trong service. |
| Admin | Có dashboard, tìm kiếm user, khóa/mở khóa. `/api/admin/**` được bảo vệ theo role ADMIN ở backend. |
| Tìm kiếm | Có tìm user; tìm kiếm nhóm/bài trong nhóm; video có tham số tìm/lọc. Không thấy API tìm kiếm toàn hệ thống hoặc tìm bài feed tổng quát. |

### API hiện có theo controller

Các API REST nằm dưới `/api`; endpoint dưới đây được tổng hợp từ mapping trong controller, không phải tài liệu API contract hoàn chỉnh:

- `/api/auth`: `register/send-code`, `register/verify-code`, `register`, `login`, `refresh`, `logout`.
- `/api/users`: `me`, hồ sơ theo ID, cập nhật profile/password/avatar/cover, `search`.
- `/api/friends`: requests (gửi/chấp nhận/từ chối/received/sent), `accepted`.
- `/api/blocks`: block/unblock user.
- `/api/feed`: list/create, privacy, like/reaction, comments, share, delete.
- `/api/stories`: list/create/delete/upload.
- `/api/groups`: nhóm, membership, posts/media/comments/reactions, polls, events, reports, moderation, upload, invite và group notifications.
- `/api/events`: list/detail/create/update/delete/attendance/upload.
- `/api/conversations`: list, requests/archived, archive, details, private/group conversation, member management.
- `/api/messages`: gửi/lấy lịch sử, edit/recall/reaction/upload.
- `/api/notifications`: list, unread count, read/read-all/delete.
- `/api/saved`: list/toggle, collections, gán/bỏ collection và status.
- `/api/videos`: list/upload/CRUD/media/views/save/follow/report.
- `/api/admin`: dashboard/users/lock/unlock.
- `/uploads/{fileName}` và các route media thuộc nhóm/video: phục vụ file.

Chat STOMP dùng các đích như `/app/chat.send`, `/app/chat.seen`, `/app/chat.typing`, `/app/chat.edit`, `/app/chat.recall` và `/app/call.signal`; server phát sự kiện theo topic hội thoại/user.

**Mức độ kiểm chứng:** Route, controller và service cho thấy các chức năng nêu trên có code. Bộ test hiện có chỉ gồm `StudentEmailPolicyTest`, `GroupServiceAccessTest`, `FeedPrivacyTest`; không có frontend test script. Vì vậy mức bao phủ, độ ổn định production và mọi nhánh nghiệp vụ khác: **Chưa xác định**.

## 5. Database và schema

### Hệ quản trị và kết nối

- Dự án cấu hình **Microsoft SQL Server**, JDBC URL dùng `jdbc:sqlserver`, driver `SQLServerDriver`, dialect `SQLServerDialect`.
- Cấu hình mặc định chỉ ra host/port/database qua `DB_HOST`, `DB_PORT`, `DB_NAME`; thông tin đăng nhập qua `DB_USERNAME`, `DB_PASSWORD`.
- [`backend/docker-compose.yml`](../backend/docker-compose.yml) chỉ khởi chạy SQL Server 2022 ở cổng `1433`, có volume `sqlserver-data`. Không thấy Docker service cho backend hoặc frontend.
- Cấu hình local nằm trong `backend/application-local.yml` và file mẫu `application-local.example.yml`; `.gitignore` loại file local và `.env`. Giá trị bí mật/cấu hình máy cá nhân không được đưa vào báo cáo. Cấu hình hiệu lực cuối cùng sau environment override: **Chưa xác định**.

### Bảng/entity theo mã nguồn

Source khai báo 40 JPA entity với `@Table`, ngoài các enum/entity files khác. Các nhóm bảng và quan hệ chính:

- **Tài khoản/xác thực:** `USERS` là gốc tài khoản; `EMAIL_VERIFICATION`, `REFRESH_TOKEN` tham chiếu thông tin phục vụ đăng ký/phiên.
- **Social feed:** `SOCIAL_POST` tham chiếu author và có self-reference tới bài được share; `SOCIAL_POST_COMMENT` và `SOCIAL_POST_REACTION` liên kết bài/người dùng.
- **Bạn bè và chat:** `FRIEND_REQUEST` tham chiếu sender/receiver; `CONVERSATION` nối người dùng qua `CONVERSATION_MEMBER`; `MESSAGE` nối hội thoại và sender, có thể reply message; `ATTACHMENT`, `MESSAGE_REACTION`, `MESSAGE_STATUS` gắn với message/user.
- **Nhóm xã hội:** `GROUPS`, `GROUP_MEMBERS`, `GROUP_POSTS`, `GROUP_COMMENTS`, `GROUP_REACTIONS`, join requests, invites, bans, reports, notifications, polls/options/votes và events/participants.
- **Lưu nội dung:** `SAVED_ITEMS`, `SAVED_COLLECTIONS`, `SAVED_COLLECTION_ITEMS`.
- **Sự kiện/story/video:** `SOCIAL_EVENT`, `SOCIAL_EVENT_PARTICIPANT`, `SOCIAL_STORY`, `VIDEO_FOLLOW`, `VIDEO_REPORT`, `VIDEO_SAVED`, `VIDEO_VIEW`.
- **Khác:** `BLOCK`, `APP_NOTIFICATION`.

Tên mapping trong entity source đầy đủ:

```text
APP_NOTIFICATION, ATTACHMENT, BLOCK, CONVERSATION, CONVERSATION_MEMBER,
EMAIL_VERIFICATION, FRIEND_REQUEST, GROUPS, GROUP_BANS, GROUP_COMMENTS,
GROUP_EVENTS, GROUP_EVENT_PARTICIPANTS, GROUP_INVITES, GROUP_JOIN_REQUESTS,
GROUP_MEMBERS, GROUP_NOTIFICATIONS, GROUP_POLLS, GROUP_POLL_OPTIONS,
GROUP_POLL_VOTES, GROUP_POSTS, GROUP_REACTIONS, GROUP_REPORTS, MESSAGE,
MESSAGE_REACTION, MESSAGE_STATUS, REFRESH_TOKEN, SAVED_COLLECTIONS,
SAVED_COLLECTION_ITEMS, SAVED_ITEMS, SOCIAL_EVENT, SOCIAL_EVENT_PARTICIPANT,
SOCIAL_POST, SOCIAL_POST_COMMENT, SOCIAL_POST_REACTION, SOCIAL_STORY, USERS,
VIDEO_FOLLOW, VIDEO_REPORT, VIDEO_SAVED, VIDEO_VIEW
```

**Tái sử dụng phù hợp cho Forum:** `USERS` làm chủ tài khoản; các repository/service identity và `@CurrentUser`; notification framework có thể mở rộng; filesystem upload có thể dùng lại sau khi bổ sung kiểm soát truy cập; SavedItem có thể là ứng viên nếu contract hiện tại hỗ trợ loại nội dung mới. `SOCIAL_POST`/`GROUP_POSTS` có thể tham khảo cách biểu diễn nội dung, nhưng không nên mặc định dùng chung làm topic/reply Forum vì mô hình quyền, vòng đời, phân trang, đính kèm và kiểm duyệt khác nhau.

### Quản lý schema — điểm cần thận trọng

- [`application.yml`](../backend/src/main/resources/application.yml) đặt Hibernate `ddl-auto: update`.
- Cùng cấu hình đặt `spring.sql.init.mode: always` với 8 script `ensure-*.sql` trong classpath. Theo cấu hình, SQL init sẽ chạy khi ứng dụng khởi động; các script này có khả năng bổ sung/chỉnh schema.
- Có các script SQL riêng trong `backend/database/`, bao gồm migration theo ngày và các file `migrate-*`; không thấy Flyway/Liquibase dependency trong `pom.xml`.
- [`backend/database/schema.sql`](../backend/database/schema.sql) mang dấu hiệu đã cũ: header ghi “9 JPA entities” và footer “12 tables”, trong khi nội dung có 14 lệnh tạo bảng, còn JPA source hiện có 40 mapping. Script này có lệnh `DROP TABLE`; **không chạy script này trên database đã có dữ liệu**.
- Schema thực tế trong SQL Server, trạng thái migration đã áp dụng, constraints/index hiện có và chênh lệch với source: **Chưa xác định**. Báo cáo không kết nối database và không chạy bất kỳ script nào.

## 6. Xác thực, tài khoản và phân quyền

- Đăng ký theo ba bước email: gửi mã, xác minh mã để nhận verification token, tạo tài khoản. `StudentEmailPolicy` giới hạn domain `st.cmcu.edu.vn`.
- Mật khẩu lưu qua BCrypt. Đăng nhập chấp nhận username hoặc email (nếu email định danh duy nhất).
- JWT access token theo cấu hình 24 giờ; refresh token 30 ngày và được lưu/thu hồi trong database. Logout thu hồi refresh token của user.
- **Tài liệu và cấu hình không thống nhất:** README mô tả access token 15 phút và refresh token 7 ngày; `application.yml` khai báo 24 giờ và 30 ngày. Giá trị hiệu lực khi chạy còn có thể bị override bởi cấu hình local/environment nên **Chưa xác định** nếu không kiểm tra môi trường triển khai.
- Backend stateless qua Spring Security; `JwtAuthenticationFilter` xác minh JWT từ header `Authorization`; `@CurrentUser` phân giải user ID từ authenticated principal.
- Global role enum `Role` hiện có `USER`, `ADMIN`. `SecurityConfig` bảo vệ `/api/admin/**` với ADMIN; phần lớn endpoint còn lại yêu cầu authenticated. Các route auth, WebSocket và một số media/upload được cấu hình riêng.
- Nhóm xã hội có membership/role riêng do `GroupService` kiểm tra. README mô tả các quyền OWNER/ADMIN/MODERATOR/MEMBER; global `Role` không chứa các giá trị đó. Chi tiết mapping và ma trận quyền nhóm cần xem theo từng action nếu tái sử dụng.
- Frontend lưu access/refresh token trong `localStorage`, và có refresh interceptor trong Axios. `ProtectedRoute` bảo vệ route UI nhưng không thay thế phân quyền backend.

**Khả năng tái dùng cho Forum:** dùng cùng `USERS`, login/JWT, `@CurrentUser`, `UserRepository`, `SecurityConfig`, `ProtectedRoute` và Axios client; thêm policy/authorization cho từng tài nguyên Forum ở backend. Không cần tạo hệ tài khoản thứ hai.

## 7. Frontend và các thành phần có thể tái sử dụng

- Routing trong `frontend/src/App.jsx`; trang đăng nhập/đăng ký và các page chức năng dùng `MainLayout`.
- Route đã có: `/feed`, `/video`, `/saved`, `/events` (và chi tiết event), `/groups`, `/groups/:groupId`, `/notifications`, `/feed/profile` và `/feed/profile/:profileUserId`, `/messages`, `/chat/:conversationId`, `/friends`, `/friends/suggestions`, `/admin`.
- API modules theo feature trong `frontend/src/api/`; Axios tự đính kèm token và refresh phiên.
- `AuthContext` chia sẻ phiên/user; `SocketContext` cung cấp kết nối STOMP dùng chung.
- Component có thể tái sử dụng: `AppTopBar`, `Sidebar`/`NavRail`, `Avatar`, `PostCard`, `PostMenu`, `ProtectedRoute`, `EmptyState`, `LoadingState`, `ErrorState`, `SettingsModal`.
- CSS tổ chức theo page/feature và có design tokens; có các style feed, groups, profile, events, components.
- Có thể tích hợp Forum thành các page và component riêng, dùng lại auth/layout/notification/avatar/error/loading/API patterns. Cần xác nhận thiết kế điều hướng để thêm lối vào Forum mà không làm đổi luồng Social hiện tại.

## 8. Backend và các thành phần có thể tái sử dụng

- Controller → Service → Repository → Entity; request/response DTO phân package theo feature.
- `@Valid` được dùng cho một số request; `ApiException` và `GlobalExceptionHandler` xử lý lỗi nghiệp vụ, validation, access denied và lỗi chung.
- `SecurityConfig`, JWT filter, `@CurrentUser`, `UserRepository`, auth service/repository là nền tảng dùng chung.
- `FileStorageService`, `UploadDirectory`, upload validation và các cơ chế media nhóm là prior art, nhưng không mặc định an toàn cho tài liệu Forum cần phân quyền.
- Spring Data JPA và SQL Server dialect phù hợp để mở module Forum trong cùng backend.
- `NotificationService`, DTO/API thông báo, saved items và entity user có thể là điểm tích hợp nếu nghiệp vụ mới yêu cầu.

## 9. Phần cần xây dựng mới cho Forum

Không có code Forum trong repository được rà soát. Phạm vi mới dự kiến (cần chốt nghiệp vụ trước khi triển khai):

- Domain Forum riêng: danh mục/chủ đề học phần, topic/question, reply/answer, tag và trạng thái nội dung.
- Đính kèm tài liệu gắn với topic/reply; download được kiểm soát bằng quyền truy cập thay vì chỉ dựa vào URL.
- Tương tác theo yêu cầu: bookmark, reaction/vote, câu trả lời được chấp nhận, báo cáo, kiểm duyệt, lịch sử chỉnh sửa nếu được yêu cầu.
- Backend packages/controller/service/repository/entity/DTO và API phân trang, sắp xếp, tìm kiếm.
- Frontend route/page/component/API module/style riêng, nhập vào routing/layout hiện có.
- Quy tắc quyền Forum (public/private theo học phần, người đăng, moderator/admin), thông báo và audit phù hợp yêu cầu.
- Schema SQL Server mới, migration có version/rollback/review và index theo các truy vấn đã xác định.

## 10. Rủi ro khi tích hợp

1. **Schema tự cập nhật:** `ddl-auto=update` kết hợp `sql.init.mode=always` có thể tác động database mỗi lần chạy ứng dụng; phải hiểu rõ quy trình hiện tại trước khi thêm schema Forum.
2. **Script schema không đồng bộ và có tính phá hủy:** `schema.sql` có `DROP TABLE`, số bảng ghi trong comment/footer không khớp nội dung hay model hiện tại.
3. **File học tập có thể cần bảo mật cao hơn file social:** route `/uploads/**` được cho phép ở SecurityConfig trong khi file private cần xác thực/kiểm tra quyền theo bản ghi. Không tái sử dụng URL public cho tài liệu riêng tư nếu chưa xác minh đầy đủ luồng.
4. **Ràng buộc upload:** cấu hình multipart cho request tới 200MB; giới hạn upload thường 10MB và video có cấu hình riêng; group có danh sách extension/MIME riêng. Forum cần quy định nhất quán loại file, dung lượng, download, retention/quota và chống file độc hại.
5. **Tách biệt nội dung nghiệp vụ:** dùng chung `SOCIAL_POST` hoặc `GROUP_POSTS` có thể kéo theo privacy, group membership và moderation không phù hợp với topic/reply học thuật.
6. **Phân quyền:** vai trò global đơn giản; quyền Forum cần moderator/giảng viên/quản trị theo phạm vi. UI route guard không đủ, mọi quyền phải xác minh ở backend cho từng tài nguyên.
7. **Tìm kiếm và tải dữ liệu:** feed tổng quát hiện không có endpoint search riêng; Forum cần thiết kế phân trang, lọc và index SQL Server từ đầu, không giả định search hiện tại đáp ứng.
8. **Chất lượng kiểm thử:** chỉ nhận diện được ba test class backend; chưa có frontend test script. Rủi ro regression tăng nếu bổ sung routes/auth/schema mà không bổ sung kiểm thử tích hợp.
9. **Cấu hình môi trường:** `application-local.yml` và environment variables có thể override cấu hình; CORS source trong `SecurityConfig` đang đặt origin pattern `*` dù có property danh sách allowed origins. Cấu hình production hiệu lực và chính sách CORS: **Chưa xác định**.
10. **Lưu trữ local:** dữ liệu upload phụ thuộc filesystem/volume của host; chưa thấy backup/HA/object storage policy trong repository. Deploy nhiều backend instance sẽ cần chiến lược chia sẻ file.

## 11. Đề xuất kiến trúc tích hợp

Giữ nguyên monolith Spring Boot + React SPA + Microsoft SQL Server hiện tại. Forum là module nghiệp vụ độc lập trong cùng repository, cùng tài khoản và database, không thay thế Social Network:

```text
backend/src/main/java/com/example/messaging/forum/
  controller/  service/  repository/  entity/  dto/

frontend/src/
  pages/forum/  components/forum/  api/forumApi.js  styles/forum.css

Database (SQL Server):
  bảng forum mới, FK tới USERS.user_id; không sửa nghĩa dữ liệu SOCIAL_POST
```

Đề xuất triển khai:

- Dùng `USERS.user_id` làm tác giả/actor và JWT hiện tại để đăng nhập; phân quyền từng thao tác Forum trong service/backend, giữ authorization theo nguyên tắc least privilege.
- Thiết kế bảng Forum riêng. Tên cụ thể chỉ chốt sau khi xác nhận nghiệp vụ; hướng mô hình có thể gồm categories/courses, topics, replies, attachments, tags, reactions/bookmarks, reports/moderation.
- Dùng REST cho luồng Forum ban đầu; chỉ dùng WebSocket nếu có yêu cầu realtime cụ thể. Không ghép Forum vào chủ đề chat.
- Tái sử dụng UI/API primitives, nhưng giữ page/API/domain logic riêng để Social Network hiện tại không bị thay đổi ngoài navigation đã duyệt.
- Dùng SQL Server cho toàn bộ bảng mới. Lập migration có version và review tác động; không phụ thuộc việc Hibernate tự sửa schema trong production.
- Tài liệu phải có access-control ở upload và download, lưu metadata trong DB, và liên kết file với đối tượng Forum. Xác định rõ public/private trước khi chọn cơ chế lưu.

## 12. Kế hoạch triển khai theo giai đoạn

1. **Chốt nghiệp vụ và quyền:** xác định đối tượng Forum, vai trò, tính riêng tư, vòng đời bài viết, moderation, tài liệu và thông báo.
2. **Thiết kế domain/API/schema:** ERD, SQL Server DDL/migration, constraints/index, API contract, authorization matrix và chính sách upload; rà soát với schema hiện hành trước khi áp dụng.
3. **Backend nền tảng Forum:** entity/repository/service/controller/DTO, validation, phân trang, permission checks, lỗi API và test unit/integration.
4. **Upload/download an toàn:** giới hạn loại/dung lượng, metadata, phân quyền truy cập, xử lý file không hợp lệ và chiến lược backup/lưu trữ.
5. **Frontend Forum:** route/navigation, danh mục/list/detail/editor, search/filter, attachment UI, trạng thái loading/error/empty; tái sử dụng design system hiện có.
6. **Tích hợp và regression:** kiểm tra tài khoản dùng chung; đảm bảo không ảnh hưởng login, feed, chat, group, events và admin; bổ sung frontend/backend tests.
7. **Triển khai có kiểm soát:** backup, áp migration lên môi trường kiểm thử, xác nhận tương thích, kế hoạch rollback, sau đó mới phát hành; theo dõi dung lượng file và query/index.

Các giai đoạn có phụ thuộc; chưa thực hiện bước code, migration hay thay đổi triển khai trong báo cáo này.

## 13. Thông tin cần xác nhận

1. Forum tổ chức theo khoa, môn học, lớp, học kỳ hay taxonomy nào? Có cần liên kết mã môn/lớp hoặc hệ thống học vụ ngoài dự án không?
2. Ai được đọc/đăng: mọi tài khoản CMC, thành viên lớp, giảng viên, hay người ngoài? Có nội dung public/private không?
3. Vai trò Forum gồm những ai (moderator, giảng viên, admin)? Ai cấp quyền và phạm vi quyền là toàn hệ thống hay theo môn học?
4. Đơn vị nội dung cần là câu hỏi/trả lời, bài thảo luận, tài liệu độc lập hay kết hợp? Có accepted answer, vote, reaction, comment/reply và sửa/xóa không?
5. Loại file, dung lượng tối đa, quota, quyền download, retention, kiểm duyệt file và lưu trữ local/cloud mong muốn?
6. Có cần report/duyệt bài, audit lịch sử, chống spam, nội dung ẩn danh, chính sách bản quyền/trích dẫn không?
7. Cần notification nào (in-app/email/realtime/push)? Có cần search toàn văn tài liệu hay chỉ metadata/title/content?
8. Quy mô dự kiến: số user, môn/chủ đề, bài viết, kích thước file và đồng thời truy cập? Đây là đầu vào cho index, pagination và storage.
9. Có tài liệu, ERD, giao diện hoặc mã nguồn Forum độc lập để tham khảo nghiệp vụ không? Repository hiện tại không có artefact Forum riêng.
10. Database SQL Server hiện tại ở môi trường nào, ai quản lý backup/deploy schema, và migration được duyệt theo quy trình nào? Trạng thái DB thực tế hiện **Chưa xác định**.
11. Có chấp thuận giữ nguyên layout và style hiện tại, bổ sung route/navigation `/forum`, và giữ API/domain Forum tách khỏi feed/nhóm không?
12. Tiêu chí nghiệm thu tối thiểu cho phiên bản Forum đầu tiên là gì?

## Nguồn mã nguồn chính

- [README.md](../README.md)
- [backend/pom.xml](../backend/pom.xml)
- [backend/src/main/resources/application.yml](../backend/src/main/resources/application.yml)
- [backend/database/schema.sql](../backend/database/schema.sql)
- [backend/docker-compose.yml](../backend/docker-compose.yml)
- [frontend/package.json](../frontend/package.json)
- [frontend/src/App.jsx](../frontend/src/App.jsx)
- [backend/src/main/java/com/example/messaging/config/SecurityConfig.java](../backend/src/main/java/com/example/messaging/config/SecurityConfig.java)
- [backend/src/main/java/com/example/messaging/controller/GroupController.java](../backend/src/main/java/com/example/messaging/controller/GroupController.java)
