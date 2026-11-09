# PHASE 0 — Read-only audit, security policy & database safety

> **Phạm vi:** Kiểm tra source, cấu hình và tài liệu ở chế độ chỉ đọc để chuẩn bị tích hợp Study Forum. Không kết nối database, khởi động ứng dụng/Docker, chạy SQL/migration, cài package hay thay đổi source trong Phase 0.
>
> **Quy ước:** `[ĐÃ XÁC NHẬN TỪ SOURCE]` chỉ mô tả điều thể hiện trong repository; `[ĐÃ XÁC NHẬN TỪ DATABASE]` chỉ dùng khi có bằng chứng từ database đang chạy; `[CHƯA XÁC NHẬN]` là thông tin chưa có bằng chứng; `[RỦI RO]` là nguy cơ cần xử lý; `[ĐỀ XUẤT]` là hướng xử lý, chưa phải thay đổi đã được phê duyệt.

## 1. Tổng quan và kết luận Phase 0

- [ĐÃ XÁC NHẬN TỪ SOURCE] BTL_CNPhanMem là ứng dụng Spring Boot/React hiện hữu; cấu hình source sử dụng Microsoft SQL Server. Forum chưa có module triển khai trong source được kiểm tra. Các tài liệu nền tảng đã đọc: [ANALYSIS_EXISTING_PROJECT.md](ANALYSIS_EXISTING_PROJECT.md), [FORUM_INTEGRATION_DESIGN.md](FORUM_INTEGRATION_DESIGN.md) và [FORUM_MVP_DECISIONS.md](FORUM_MVP_DECISIONS.md).
- [CHƯA XÁC NHẬN] Không có xác nhận từ database đang chạy trong Phase này. Không thể kết luận schema thực tế, phiên bản migration, dữ liệu hiện có hay trạng thái backup của bất kỳ database cụ thể nào.
- [RỦI RO] Cấu hình trong source có khả năng thay đổi database khi ứng dụng khởi động: Hibernate `ddl-auto: update` và SQL init `mode: always`; các script được cấu hình có câu lệnh ALTER/UPDATE/CREATE INDEX. Ngoài ra, `backend/database/schema.sql` có lệnh DROP TABLE và không an toàn để chạy lên database có dữ liệu cần giữ.
- [RỦI RO] Chưa tìm thấy quy trình backup/restore có thể kiểm chứng trong repository. Một số file upload nằm trong Git; Docker Compose chỉ khai báo volume cho dữ liệu SQL Server, không chứng minh đã có backup.
- [ĐỀ XUẤT] Chưa bắt đầu tạo bảng/API/UI Forum. Trước khi coding hoặc áp dụng migration, cần xác định chủ sở hữu database, kiểm kê schema thật, xác lập backup/restore đã thử nghiệm, xử lý cơ chế tự khởi tạo schema và chốt các chính sách file/quyền đang chờ.
- **Kết luận:** **CHƯA ĐỦ ĐIỀU KIỆN chuyển sang Phase 1 triển khai**. Có thể tiếp tục chuẩn bị kế hoạch và xác minh với chủ dự án/DBA; không nên đưa Forum entity hoặc schema mới vào ứng dụng trước khi xử lý các blocker tại mục 14.

## 2. Phạm vi đã kiểm tra

- [ĐÃ XÁC NHẬN TỪ SOURCE] Đã đọc ba tài liệu nền tảng nêu trên; `backend/pom.xml`; `backend/src/main/resources/application.yml`; `backend/docker-compose.yml`; schema và các SQL script trong repository; cấu hình security/JWT/current-user; các entity, service/controller liên quan đến account, social post, group, notification và upload.
- [ĐÃ XÁC NHẬN TỪ SOURCE] Đã kiểm tra tham chiếu frontend liên quan đến notification/navigation, cấu trúc thư mục upload, danh sách file và tình trạng tracking của upload ở mức metadata. Không mở nội dung file upload.
- [ĐÃ XÁC NHẬN TỪ SOURCE] Đã kiểm tra trong repository các tên file/thư mục có liên quan backup/restore và các artefact backup phổ biến. Không tìm thấy backup database, script backup/restore hay bằng chứng restore test trong phạm vi repository.
- [CHƯA XÁC NHẬN] Không đọc `backend/application-local.yml` vì đây là cấu hình local bị loại khỏi Git và có thể chứa credential. Các giá trị secret, password, JWT secret, connection string đầy đủ và nội dung dữ liệu người dùng không được đưa vào báo cáo.
- [CHƯA XÁC NHẬN] Không kết nối SQL Server: không có thông tin kết nối được xác minh là an toàn để dùng cho truy vấn metadata; không khởi động ứng dụng để lấy kết nối. Không chạy truy vấn SELECT trên database.
- [ĐÃ XÁC NHẬN TỪ SOURCE] Không chạy build/test, không khởi động ứng dụng hoặc Docker, không chạy SQL/script/migration và không cài/gỡ package.

## 3. Kiến trúc và công nghệ xác nhận

- [ĐÃ XÁC NHẬN TỪ SOURCE] Backend sử dụng Java 17, Spring Boot 3.3.4, Spring Data JPA/Hibernate và cấu trúc package gốc `com.example.messaging`; dependency SQL Server JDBC được khai báo trong [pom.xml](../backend/pom.xml).
- [ĐÃ XÁC NHẬN TỪ SOURCE] Frontend sử dụng React 18 và Vite. Kiến trúc hiện tại là ứng dụng Social Network; chưa thấy package/module Forum trong source được kiểm tra.
- [ĐÃ XÁC NHẬN TỪ SOURCE] Cấu hình datasource trong [application.yml](../backend/src/main/resources/application.yml) dùng định dạng JDBC SQL Server, đặt database mặc định `messaging_db`, và cấu hình SQL Server dialect. Các giá trị thực tế có thể bị override bởi môi trường/cấu hình local.
- [CHƯA XÁC NHẬN] Không thể xác định database/schema/server thực tế mà một môi trường đang kết nối, cũng như database có thực sự tên `messaging_db` hay không.
- [ĐÃ XÁC NHẬN TỪ SOURCE] [docker-compose.yml](../backend/docker-compose.yml) định nghĩa SQL Server 2022 Developer, publish cổng 1433 và named volume `sqlserver-data` gắn với thư mục dữ liệu SQL Server.
- [CHƯA XÁC NHẬN] Cấu hình Docker Compose là cấu hình development trong repository, không xác nhận cấu hình production, chính sách lưu trữ volume, backup định kỳ hoặc khả năng restore.

## 4. Database và schema

### 4.1 Phân biệt ba loại schema

1. **Schema được mô tả trong source**
   - [ĐÃ XÁC NHẬN TỪ SOURCE] [backend/database/schema.sql](../backend/database/schema.sql) chứa DDL SQL Server, dùng schema `dbo` trong nhiều câu lệnh; có `CREATE DATABASE` có điều kiện và nhiều `DROP TABLE` trước khi tạo lại các bảng.
   - [ĐÃ XÁC NHẬN TỪ SOURCE] Script `schema.sql` có các bảng Social/account và chứa thao tác phá hủy dữ liệu. Phần mô tả/count trong script cũ không nhất quán với số entity hiện tại; không dùng các ghi chú trong script làm bằng chứng schema thực tế.
   - [ĐÃ XÁC NHẬN TỪ SOURCE] `seed-data.sql` chứa câu lệnh INSERT; không thấy nó được khai báo trong danh sách SQL init của `application.yml`. Không chạy script này.
   - [ĐÃ XÁC NHẬN TỪ SOURCE] Không tìm thấy dependency Flyway hoặc Liquibase trong [pom.xml](../backend/pom.xml). Repository có SQL script thủ công và các script `ensure-*.sql`.

2. **Schema ứng dụng kỳ vọng**
   - [ĐÃ XÁC NHẬN TỪ SOURCE] Có khoảng 40 entity ánh xạ bằng `@Table`; JPA/Hibernate tạo kỳ vọng schema từ các entity hiện hành. Số entity này không chứng minh mọi bảng đang tồn tại trong database.
   - [ĐÃ XÁC NHẬN TỪ SOURCE] Các entity sử dụng tên bảng nhưng phần lớn không chỉ định schema rõ ràng; schema mặc định còn phụ thuộc database/user/cấu hình runtime. Các SQL script lại có câu lệnh ghi rõ `dbo`.
   - [ĐÃ XÁC NHẬN TỪ SOURCE] Các bảng liên quan gồm `USERS`, bảng role/account, `SOCIAL_POST`, bảng comment/reaction/saved item, group và membership, message/conversation, `APP_NOTIFICATION`, cùng các bảng liên quan status/event/video. Các entity hiện có quan hệ FK đến `USERS` ở những quan hệ được khai báo trong mapping.
   - [CHƯA XÁC NHẬN] Tên constraint/index, độ phủ của FK/index và tình trạng migration trong database đang chạy không thể suy ra đầy đủ chỉ từ entity/SQL script.

3. **Schema database thực tế**
   - [CHƯA XÁC NHẬN] Chưa kiểm tra `sys.tables`, `sys.columns`, `sys.foreign_keys`, `sys.indexes`, `INFORMATION_SCHEMA` hay dữ liệu cấu trúc nào từ SQL Server.
   - [CHƯA XÁC NHẬN] Không biết database thực tế có cùng schema với `schema.sql`, JPA mapping hoặc các script `ensure-*.sql` hay không. Không được coi ba nguồn này là đồng nhất.
   - [CHƯA XÁC NHẬN] Chưa thể xác nhận có bảng Forum trùng tên/xung đột trong database thật. Trong source đang kiểm tra, chưa thấy module Forum/tên bảng Forum được ánh xạ.

### 4.2 Các bảng liên quan và hướng tách Forum

- [ĐÃ XÁC NHẬN TỪ SOURCE] `USERS` là bảng tài khoản hiện hữu được entity khác tham chiếu. Không có lý do tạo account table thứ hai cho Forum.
- [ĐỀ XUẤT] Giữ nguyên bảng Social và quan hệ hiện hữu; bảng Forum đặt tên/prefix riêng, tham chiếu `USERS.user_id` bằng FK sau khi xác minh kiểu cột, schema và constraint thực tế với DBA.
- [ĐỀ XUẤT] Theo phân loại trong `FORUM_MVP_DECISIONS.md`, **MUST HAVE** gồm đúng 10 bảng: `FORUM_CATEGORIES`, `FORUM_COURSES`, `FORUM_TAGS`, `FORUM_TOPICS`, `FORUM_REPLIES`, `FORUM_TOPIC_TAGS`, `FORUM_ATTACHMENTS`, `FORUM_REPORTS`, `FORUM_MODERATOR_SCOPES` và `FORUM_MODERATION_ACTIONS`. **SHOULD HAVE:** `FORUM_BOOKMARKS`. **LATER:** `FORUM_ACADEMIC_UNITS`, `FORUM_TOPIC_FOLLOWS` và `FORUM_REACTIONS`. `APP_NOTIFICATION` là bảng hiện có được tái sử dụng, không phải bảng Forum mới và không tính vào tổng số 14 bảng thiết kế. Những bảng Forum này là đề xuất thiết kế, chưa tồn tại/được xác nhận trong database thực tế.
- [CHƯA XÁC NHẬN] Cần đối chiếu lại thiết kế cuối cùng với schema thực tế và chủ dự án trước khi chốt tên/kiểu dữ liệu/FK/unique/index. Danh sách trên là thiết kế, không phải bảng đã tồn tại.

## 5. Rủi ro khởi tạo database

### 5.1 Cấu hình tự động

- [ĐÃ XÁC NHẬN TỪ SOURCE] `spring.jpa.hibernate.ddl-auto` được cấu hình `update` trong [application.yml](../backend/src/main/resources/application.yml). Khi ứng dụng khởi động, Hibernate có thể tự tạo/cập nhật cấu trúc theo entity đang có; nếu bổ sung Forum entity trước khi kiểm soát cơ chế này, schema có thể bị thay đổi ngoài một migration được duyệt.
- [ĐÃ XÁC NHẬN TỪ SOURCE] `spring.sql.init.mode` được cấu hình `always`; `schema-locations` liệt kê tám script `ensure-*.sql` trong resources. Đây là hoạt động khởi tạo SQL khi ứng dụng khởi động, không phải truy vấn chỉ đọc.
- [ĐÃ XÁC NHẬN TỪ SOURCE] Các script có guard kiểu “chỉ thêm nếu chưa tồn tại” nhưng vẫn có thao tác ghi:
  - `ensure-video-schema.sql`: DDL/index/tạo cấu trúc liên quan video; có `UPDATE` dữ liệu `SOCIAL_POST` để bổ sung/chuẩn hóa `media_type` cho bản ghi hiện có.
  - `ensure-group-unicode-columns.sql`: ALTER các cột của bảng Social, gồm chuyển kiểu cột văn bản sang NVARCHAR.
  - `ensure-user-email.sql`: thay đổi cấu trúc/index của bảng `USERS`, gồm thao tác drop/create index có điều kiện.
  - `ensure-user-cover-image.sql`: ALTER `USERS`, `SOCIAL_POST` và `SOCIAL_EVENT`; bổ sung cột/constraint và thay đổi kiểu cột event có điều kiện.
  - `ensure-message-edit-schema.sql`, `ensure-message-request-schema.sql`, `ensure-conversation-requests.sql`, `ensure-conversation-background.sql`: ALTER bảng conversation/message/member, một số cột NOT NULL có DEFAULT `WITH VALUES`.
- [RỦI RO] Các script có thể tác động trực tiếp schema hoặc dữ liệu Social dù tên gọi “ensure” và các guard khiến chúng có vẻ idempotent. Guard không đồng nghĩa read-only, không đảm bảo an toàn với mọi trạng thái schema và không thay thế review/migration.
- [RỦI RO] `schema.sql` có DROP TABLE, gồm bảng tài khoản/Social; chạy nhầm có thể phá hủy dữ liệu. Source cấu hình SQL init hiện chỉ định danh sách script ensure, không phải `schema.sql`; tuy nhiên script nguy hiểm vẫn tồn tại và cần được đánh dấu/cô lập trong quy trình vận hành.
- [ĐÃ XÁC NHẬN TỪ SOURCE] Không thấy `data.sql` trong cấu hình/file đã kiểm tra; `seed-data.sql` là script riêng có INSERT và không được xác nhận là chạy tự động.
- [CHƯA XÁC NHẬN] Không khởi động ứng dụng nên chưa xác nhận thứ tự thực thi thực tế, log SQL, trạng thái thành công/lỗi hoặc ảnh hưởng trên bất kỳ database nào.

### 5.2 Docker và dữ liệu lưu trữ

- [ĐÃ XÁC NHẬN TỪ SOURCE] Compose volume `sqlserver-data` giữ dữ liệu SQL Server trong volume Docker khi volume còn tồn tại; nó không phải backup độc lập.
- [ĐÃ XÁC NHẬN TỪ SOURCE] Compose không khai báo volume/backup job tương ứng cho thư mục uploads trong cấu hình đã kiểm tra.
- [RỦI RO] Xóa volume khi dọn môi trường (ví dụ thao tác down kèm xóa volume) có thể làm mất database development. Không thực hiện thao tác đó trong Phase 0.
- [CHƯA XÁC NHẬN] Không biết có backup ngoài repository, snapshot storage, backup cloud/host hay lịch vận hành khác.

## 6. Backup/restore

- [CHƯA XÁC NHẬN] Không tìm thấy script backup SQL Server, file backup phổ biến, hướng dẫn restore hoặc bằng chứng restore test trong repository. Đây không phải bằng chứng rằng DBA/tổ chức không có backup bên ngoài repository.
- [ĐÃ XÁC NHẬN TỪ SOURCE] Có upload ở cả `uploads/` và `backend/uploads/`. Tại thời điểm kiểm tra metadata: root `uploads/` có 83 file, trong đó 50 file được Git track và 33 file untracked; `backend/uploads/` có 8 file được Git track. Không mở nội dung file.
- [RỦI RO] Upload được track trong Git có thể khiến nội dung/môi trường file bị gắn với vòng đời repository; phần upload untracked có thể không được chuyển/backup khi clone hoặc deploy. Cần xác nhận đây là dữ liệu mẫu hay dữ liệu cần bảo vệ; không tự di chuyển/xóa/thay đổi chúng.
- [CHƯA XÁC NHẬN] Chưa có bằng chứng backup upload được đồng bộ với backup database hoặc có restore test khôi phục cả hai loại dữ liệu.

### Checklist bắt buộc trước migration

1. Chủ dự án/DBA xác nhận server, database, schema, môi trường và chủ sở hữu dữ liệu; chụp inventory metadata read-only có kiểm soát.
2. Lập bản backup đầy đủ theo recovery model/chính sách DBA; giữ bản sao ngoài volume/database host và xác minh job/log/checksum theo quy trình được duyệt.
3. Backup riêng toàn bộ storage upload cần giữ, bao gồm cả metadata/đường dẫn; ghi nhận quan hệ file với database để khôi phục nhất quán.
4. Thực hiện restore thử trên môi trường cô lập, không phải database production; kiểm tra database mở được, bảng/index/FK quan trọng và file truy cập được.
5. Ghi rõ người phê duyệt, thời gian, backup ID, phạm vi, kết quả restore test, thời gian lưu và phương án rollback.
6. Chỉ sau khi restore test được chấp nhận mới lên lịch migration; không coi việc có file backup/volume là bằng chứng restore thành công.

## 7. Authentication/authorization

- [ĐÃ XÁC NHẬN TỪ SOURCE] Spring Security cấu hình stateless; JWT được phát/kiểm tra qua `JwtUtil` và `JwtAuthenticationFilter`. Filter lấy principal người dùng từ dữ liệu account hiện tại; không tạo một kho account riêng cho Forum.
- [ĐÃ XÁC NHẬN TỪ SOURCE] `CurrentUserArgumentResolver` lấy user ID từ principal đã xác thực để inject vào controller. Đây là cơ sở tái sử dụng identity hiện tại; các API Forum không được tin `userId` do client tự gửi.
- [ĐÃ XÁC NHẬN TỪ SOURCE] Role toàn cục hiện có `USER` và `ADMIN`; security áp dụng guard cho `/api/admin/**`, còn các API không public cần xác thực theo cấu hình. Chưa có role toàn cục `MODERATOR`.
- [ĐỀ XUẤT] Dùng chung JWT/account hiện hành; quyền Forum phải được kiểm tra ở backend tại mỗi request. USER quản lý nội dung của mình; moderator được gán phạm vi category bằng assignment riêng của Forum; ADMIN có quyền toàn Forum. Không thay đổi global role hoặc quyền Social chỉ để cấp moderator Forum.
- [ĐỀ XUẤT] Với topic/reply/attachment, kiểm tra đồng thời danh tính hiện tại, owner hoặc moderation scope, trạng thái nội dung, quan hệ parent-child và quyền tải file. Không dựa vào ID do client gửi, URL khó đoán hay việc ẩn nút trên frontend. Kiểm tra IDOR theo từng endpoint và từng tài nguyên con.
- [ĐỀ XUẤT] Tách authorization Forum khỏi Social, không làm thay đổi route/guard đang phục vụ Social. Moderator assignment cần quy trình cấp/thu hồi, phạm vi rõ ràng, audit người cấp và thời hạn nếu chủ dự án yêu cầu.
- [RỦI RO] `SecurityConfig` cho phép route `/uploads/**` và cấu hình CORS dùng origin pattern rộng cùng credentials; cần security review/phê duyệt cấu hình môi trường trước khi mở chức năng file Forum. Không sửa cấu hình trong Phase này.
- [RỦI RO] Cấu hình source chứa fallback cho một số giá trị nhạy cảm và Compose chứa giá trị đăng nhập SQL Server development. Các giá trị đã được lược bỏ hoàn toàn khỏi báo cáo; cần DBA/owner xác nhận production dùng secret ngoài source và không dựa vào fallback development. Không đọc hoặc công bố giá trị local.
- [CHƯA XÁC NHẬN] Chưa xác minh account/role trên database thực tế, chính sách khóa/xóa account, logout/token revoke và quy trình vận hành moderator.

## 8. Upload/storage

- [ĐÃ XÁC NHẬN TỪ SOURCE] `FileStorageService` lưu file trên local filesystem, tạo tên file ngẫu nhiên dựa trên UUID và giữ extension; có giới hạn mặc định ở mức service. `UploadDirectory` phân giải vị trí upload từ cấu hình và có thể tìm trong một số thư mục dự án/backend.
- [ĐÃ XÁC NHẬN TỪ SOURCE] Cấu hình multipart trong `application.yml` cho phép giới hạn request/file lớn hơn đáng kể giới hạn service mặc định; cần phân biệt giới hạn HTTP với giới hạn nghiệp vụ endpoint.
- [ĐÃ XÁC NHẬN TỪ SOURCE] Một số luồng upload group kiểm tra extension và MIME do client cung cấp, nhưng không thấy kiểm tra chữ ký nội dung file (magic bytes) hay antivirus/quarantine trong luồng được kiểm tra.
- [ĐÃ XÁC NHẬN TỪ SOURCE] `/uploads/**` được permit trong security; `UploadController` có kiểm tra liên quan file group riêng tư, nhưng URL static nói chung không phải cơ chế tải tài liệu Forum bảo vệ theo quyền mỗi lần truy cập.
- [RỦI RO] Không tái sử dụng trực tiếp public/static URL cho tài liệu Forum. UUID làm URL khó đoán hơn nhưng không thay thế authorization; URL bị lộ vẫn có thể cấp quyền truy cập nếu storage public.
- [ĐỀ XUẤT] Forum dùng private storage; client chỉ nhận attachment ID; download qua backend và kiểm tra quyền truy cập + trạng thái attachment mỗi lần. Giữ file cách ly `PENDING_SCAN`, chỉ cho tải trạng thái `AVAILABLE`; từ chối `REJECTED` và thu hồi quyền tải `REVOKED`.
- [ĐỀ XUẤT] Chốt allowlist extension/MIME/signature, dung lượng/file, số file/topic, quota/user, thời gian giữ file, quy trình scan/quarantine, cách xử lý file không hợp lệ, backup/restore storage và quyền truy cập trước khi triển khai.
- [CHƯA XÁC NHẬN] Các giá trị chính sách trên chưa được chủ dự án xác nhận; không có kết luận về storage production hay dịch vụ malware scanning hiện hữu.

## 9. Notification

- [ĐÃ XÁC NHẬN TỪ SOURCE] Entity `AppNotification` ánh xạ bảng `APP_NOTIFICATION`, có quan hệ recipient và optional actor với `USERS`; `reference_type/reference_id` là tham chiếu đa hình, không phải FK cụ thể tới mọi loại nội dung.
- [ĐÃ XÁC NHẬN TỪ SOURCE] `NotificationService` và `NotificationController` hỗ trợ các API tạo/list/unread/read/delete theo các luồng hiện có; frontend có UI notification và polling số chưa đọc.
- [ĐỀ XUẤT] Tái sử dụng `APP_NOTIFICATION`/service/API hiện hữu nếu mô hình payload phù hợp; thêm type/reference Forum theo cách tương thích, không tạo bảng account hoặc notification trùng lặp và không thay đổi semantics Social.
- [RỦI RO] Notification có thể tiết lộ tiêu đề/nội dung riêng tư hoặc dẫn đến topic/attachment đã bị ẩn/khóa. Backend phải kiểm tra quyền khi sinh event, hiển thị preview và xử lý link đích.
- [CHƯA XÁC NHẬN] Chưa có quyết định bắt buộc notification cho reply, accepted answer, moderation hay report; chính sách tần suất/gộp notification cũng chưa được xác nhận. Follow thuộc LATER, nên không nằm trong yêu cầu notification MUST HAVE của MVP. Không tạo notification/event Forum trong Phase 0.

## 10. Kiến trúc tích hợp Forum

- [ĐỀ XUẤT] Backend đặt module tại `com.example.messaging.forum`, tách `entity`, `repository`, `dto`, `service`, `controller`, `security`, `storage` và xử lý lỗi theo convention thực tế của repository. Không thay thế package/kiến trúc hiện tại.
- [ĐỀ XUẤT] Frontend đặt tính năng trong khu vực `src/features/forum` (pages/components/api/types/hooks) theo cấu trúc đang dùng; thêm route `/forum` vào router/navigation hiện tại dưới layout phù hợp, không thay route/layout Social.
- [ĐỀ XUẤT] Dùng chung authentication/JWT và `USERS`; tách dữ liệu nghiệp vụ bằng bảng Forum riêng, FK sang account hiện tại ở các trường creator/owner/moderator/actor khi phù hợp.
- [ĐỀ XUẤT] MVP mặc định theo tài liệu phạm vi: taxonomy do admin quản trị (không seed khoa/môn học chính thức khi chưa có dữ liệu), topic/reply/accepted answer, attachment có kiểm soát, tag/tìm kiếm/phân trang, report/moderation và moderator scope là MUST HAVE; bookmark là SHOULD HAVE; follow và reaction là LATER. `APP_NOTIFICATION` được tái sử dụng nếu bật notification, không thêm bảng notification Forum. Các chính sách vận hành chưa được chốt vẫn phải xác nhận riêng.
- [ĐỀ XUẤT] Bảo toàn toàn bộ module Social hiện tại: post/comment/reaction/share, group/membership, friend, message, notification, profile, search và admin theo đúng trạng thái source; bất kỳ thay đổi dùng chung nào phải có regression test cho API và UI Social.
- [CHƯA XÁC NHẬN] Chưa kiểm tra tương thích runtime của routing/layout hay API khi gắn Forum vì không triển khai hoặc khởi động ứng dụng trong Phase này.

## 11. Chính sách còn chờ xác nhận

Tất cả nội dung dưới đây là **CHƯA XÁC NHẬN**, dù phạm vi MVP trong `FORUM_MVP_DECISIONS.md` được dùng làm mặc định:

1. Allowlist chính xác theo extension, MIME và file signature.
2. Dung lượng tối đa mỗi file.
3. Số file tối đa cho mỗi topic/resource; MVP chưa gắn attachment vào reply.
4. Quota upload theo user và cơ chế tính quota.
5. Cách scan file trong MVP: dịch vụ scan, kiểm tra thủ công hay giới hạn loại file; trạng thái được phát hành khi nào.
6. Storage location production, private access, retention và chủ thể vận hành.
7. Backup/restore file upload, thời hạn lưu và chính sách khi xóa/ẩn topic hoặc attachment.
8. Thời điểm và loại notification bắt buộc (reply, accepted answer, moderation); notification liên quan follow chỉ xem xét nếu chức năng Follow được đưa vào phiên bản sau.
9. Có cho phép public read hay yêu cầu mọi người đăng nhập; topic hidden/restricted có quy tắc gì.
10. Có cần kiểm tra enrollment/quyền theo môn học hay tất cả account đều truy cập được.
11. Ai được đề cử/cấp/thu hồi moderator, phạm vi moderator, audit và xử lý xung đột.
12. Ai sở hữu database, ai duyệt schema/migration và ai được phép thực thi ở từng môi trường.
13. Cách backup/restore được chấp thuận, môi trường kiểm thử/QA và tiêu chí chấp nhận restore test.
14. Chính sách xóa mềm/ẩn/khóa, thời gian retention, khôi phục và xử lý attachment khi nội dung bị xóa.
15. Có yêu cầu audit log cho thao tác moderation/admin hay không.

## 12. Đề xuất migration an toàn

### So sánh phương án

| Phương án | Điểm phù hợp | Điều kiện/rủi ro |
|---|---|---|
| Versioned SQL Server scripts, review và DBA thực thi theo quy trình phát hành | Dùng SQL Server native; không cần app tự cập nhật schema; review chính xác từng DDL/DML; phù hợp trước mắt khi repository chưa có migration framework | Phải có owner, ledger phiên bản/checksum, quy trình xác định baseline hiện tại, môi trường thử và kiểm soát không chạy lại; không được để app tự quét/chạy script |
| Flyway hoặc Liquibase | Có lịch sử phiên bản, kiểm tra thứ tự/checksum và tích hợp quy trình deployment | Cần dependency/cấu hình được duyệt; phải baseline schema thực tế; phải xử lý xung đột với `ddl-auto=update`, `sql.init.mode=always` và các script ad hoc hiện tại; thêm công cụ không tự làm migration an toàn |
| Tiếp tục chạy script thủ công hiện hữu không có ledger/owner thống nhất | Ít thay đổi quy trình trước mắt | Khó biết script đã chạy ở môi trường nào, dễ chạy sai thứ tự/lặp lại; không phù hợp cho Forum và không kiểm soát được startup side effects |

### Phương án khuyến nghị

- [ĐỀ XUẤT] Trước mắt dùng **versioned SQL Server migration scripts được review và DBA/DB owner thực thi như bước phát hành có kiểm soát**, kèm migration ledger/checksum, người phê duyệt và log kết quả. Không chạy migration trong application startup. Đây là phương án ít thay đổi dependency nhất trong khi chưa có công cụ migration được duyệt.
- [ĐỀ XUẤT] Sau khi kiểm kê schema thật và baseline được xác nhận, có thể phê duyệt riêng Flyway/Liquibase nếu muốn quản lý history tự động hơn; không cài hoặc cấu hình công cụ trong Phase 0.
- [RỦI RO] Trước khi thêm Forum entity, cần thiết kế thay đổi có kiểm soát đối với `ddl-auto=update` và SQL init tự động. Không tắt/đổi cấu hình một cách mù quáng: phải kiểm tra tác động đến Social và chuyển các cập nhật cần thiết thành quy trình có review, kiểm thử và phê duyệt.

### Cổng kiểm soát cho mỗi migration tương lai

1. DBA xác nhận schema/baseline thật và các script cũ đã áp dụng; không suy luận trạng thái DB từ Git.
2. Chỉ thêm bảng/index/constraint Forum được duyệt; không DROP/ALTER bảng Social trong migration Forum nếu không có lý do và phê duyệt riêng.
3. Review SQL và thứ tự chạy; xác định trước DML, lock/transaction, dung lượng và thời gian dự kiến.
4. Backup database **và** file; restore thử thành công trong môi trường cô lập.
5. Chạy trên môi trường kiểm thử tương đương; kiểm tra schema, FK/index, dữ liệu Social và luồng khởi động.
6. Có migration ledger, log, người thực thi/phê duyệt, tiêu chí dừng và rollback/forward-fix đã được DBA duyệt.
7. Sau migration, xác minh schema bằng truy vấn metadata read-only, kiểm tra API Social/Forum và đối soát backup.

## 13. Checklist trước khi bắt đầu coding

- [ ] Đọc/xác nhận ba tài liệu nền tảng; chốt các khác biệt giữa phạm vi MVP và chính sách vận hành.
- [ ] DBA xác nhận môi trường SQL Server đích, tên database/schema và inventory metadata; không gửi credential qua chat.
- [ ] Kiểm kê schema thực tế và đối chiếu entity, `schema.sql`, `ensure-*.sql`; xác định script nào đã/ chưa áp dụng.
- [ ] Đánh giá an toàn `ddl-auto=update` và `sql.init.mode=always`; thống nhất cách ngăn startup tự thay đổi schema nhưng vẫn giữ Social hoạt động.
- [ ] Xác nhận owner/approver/executor migration, môi trường QA và quy trình ledger.
- [ ] Chứng minh backup và restore thử độc lập được cho database lẫn uploads trước khi migration.
- [ ] Xác nhận upload policy, storage private, scanning, retention và download authorization.
- [ ] Xác nhận public-read/enrollment, moderator lifecycle/scope và notification policy.
- [ ] Chốt thiết kế bảng Forum/FK/constraint/index dựa trên schema đã kiểm tra; tuyệt đối không dùng dữ liệu khoa/môn chính thức chưa được cấp.
- [ ] Lập test regression Social cho security, upload, notification, routing, dữ liệu và startup trước khi triển khai.

## 14. Các blocker cần giải quyết

1. **Schema database thật chưa xác minh.** Không thể đánh giá migration chính xác, xung đột tên/kiểu/FK/index hoặc baseline.
2. **Cơ chế startup có side effect.** `ddl-auto=update`, `sql.init.mode=always` và các ensure script có thể ALTER/UPDATE dữ liệu Social; cần DBA/owner phê duyệt cách quản lý schema trước khi bổ sung entity.
3. **Có script phá hủy trong repository.** `backend/database/schema.sql` chứa DROP TABLE; cần quy trình ngăn chạy nhầm và cảnh báo rõ.
4. **Không có bằng chứng backup/restore.** Cần backup database + upload và restore test được chứng minh trước bất kỳ migration nào.
5. **Upload chưa có bảo đảm Forum-private.** Public route/static storage và kiểm tra file hiện hữu không đủ để đáp ứng kiểm soát download tài liệu riêng tư.
6. **Chính sách nghiệp vụ/bảo mật còn mở.** File limits/scan/storage/retention/public read/enrollment/moderator/notification chưa xác nhận.
7. **Production security configuration chưa được xác nhận.** Cần xác minh secret override, CORS allowlist và cấu hình route tải file ở môi trường triển khai.

## 15. Kết luận cuối cùng

- Đã kiểm tra source/cấu hình liên quan SQL Server, entity/schema/scripts khởi tạo, Docker volume, auth/JWT/role/current user, upload/storage, notification, tài liệu thiết kế và các dấu hiệu backup/restore trong repository.
- Đã tạo báo cáo này tại `docs/FORUM_PHASE0_AUDIT.md`.
- **Schema database thực tế:** **CHƯA XÁC NHẬN**; không kết nối database và không thực hiện truy vấn.
- **Rủi ro nghiêm trọng:** startup có thể tự thay đổi database; script ensure có thao tác ALTER và một script có UPDATE dữ liệu Social; `schema.sql` chứa DROP TABLE; chưa có bằng chứng restore test; file upload hiện hữu có phần được Git track và route uploads có cơ chế truy cập công khai.
- **Cần chủ dự án/DBA xác nhận:** các chính sách tại mục 11, owner/phê duyệt migration, database/schema đích, quy trình backup/restore, cách kiểm soát startup schema và chính sách private file.
- **Phase 0:** hoàn tất ở mức audit source/tài liệu, nhưng **CHƯA ĐỦ ĐIỀU KIỆN chuyển sang Phase 1 triển khai** cho đến khi các blocker ở mục 14 được xử lý.
- **Xác nhận an toàn:** Không sửa code/cấu hình; không thay đổi database; không chạy SQL, migration, ứng dụng hoặc Docker; không cài/gỡ package; không thay đổi file upload. Chỉ tạo mới file báo cáo này.
