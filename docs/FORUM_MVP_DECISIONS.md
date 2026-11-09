# Chốt phạm vi MVP Study Forum — FMESS-CMCU

**Ngày:** 02-11-2026  
**Trạng thái:** Tài liệu đề xuất để chủ dự án duyệt; chưa phải yêu cầu đã được xác nhận.  
**Phạm vi thay đổi trong giai đoạn này:** Chỉ tạo tài liệu. Không chỉnh sửa code/cấu hình/database, không chạy SQL/migration, không cài package.

## 1. Căn cứ và nguyên tắc

Tài liệu này được lập từ [báo cáo phân tích hiện trạng](./ANALYSIS_EXISTING_PROJECT.md) và [thiết kế tích hợp Forum](./FORUM_INTEGRATION_DESIGN.md), có đối chiếu các phần source liên quan được hai tài liệu trích dẫn.

- **[ĐÃ XÁC NHẬN TỪ SOURCE]** BTL_CNPhanMem là ứng dụng Spring Boot monolith + React/Vite, Spring Security/JWT, JPA và Microsoft SQL Server. Global role hiện là `USER`, `ADMIN`; Forum chưa có trong source.
- **[ĐÃ XÁC NHẬN TỪ SOURCE]** Tài khoản dùng bảng `USERS`; upload hiện có filesystem local và route `/uploads/**` được permit trong security config; notification hiện có `APP_NOTIFICATION`/`NotificationService`.
- **[ĐÃ XÁC NHẬN TỪ SOURCE]** Cấu hình có `ddl-auto=update`, `sql.init.mode=always`; `schema.sql` có lệnh `DROP TABLE` và không phải migration an toàn để chạy lên database đang có dữ liệu. Trạng thái schema SQL Server đang chạy chưa được kiểm tra.
- **[ĐỀ XUẤT CHO MVP]** Giữ nguyên Social Network và framework; dùng chung account/JWT/SQL Server, tạo domain và bảng Forum riêng, không dùng `SOCIAL_POST`/`GROUP_POSTS` làm topic hay reply.
- **[CHƯA ĐỦ DỮ LIỆU]** Không có taxonomy chính thức CMC, dữ liệu enrollment, chính sách công khai/riêng tư, brand guideline hoặc thông số storage/retention. Không seed hoặc gán tên khoa/ngành/môn chính thức khi chưa có nguồn duyệt.

### Cách đọc phân loại

- **MUST HAVE:** điều kiện để gọi là MVP; cần có trước khi mở cho người dùng.
- **SHOULD HAVE:** có giá trị nhưng có thể hoãn nếu ảnh hưởng tiến độ; MVP không được giả vờ đã hỗ trợ.
- **LATER:** không triển khai trong MVP.
- Tất cả phân loại và mặc định nghiệp vụ bên dưới là **đề xuất chờ chủ dự án phê duyệt**, trừ những dòng ghi rõ đã xác nhận từ source.

## 2. Phạm vi MVP

MVP đề xuất là Forum web authenticated, có taxonomy do admin tự quản lý, ba loại nội dung, trả lời, học liệu tải xuống có kiểm soát quyền, tìm kiếm cơ bản và moderation tối thiểu.

### Bao gồm

1. Danh mục Forum dạng cây và môn học do admin tạo/cập nhật. Bản cài mới có thể chưa có bản ghi nếu chưa nhận dữ liệu được duyệt.
2. Topic `QUESTION`, `DISCUSSION`, `RESOURCE`; mỗi topic thuộc danh mục và có thể gắn môn học.
3. Reply; accepted answer chỉ cho `QUESTION`.
4. Upload tài liệu theo allowlist đã được chốt, metadata rõ và download qua endpoint backend kiểm tra quyền.
5. Tag cơ bản, tìm kiếm title/body/tag/course, lọc và phân trang.
6. Báo cáo topic/reply, khóa/ẩn/khôi phục, moderation assignment có scope theo category.
7. Trang Forum home, danh mục/môn học, danh sách/chi tiết topic, tạo topic/chia sẻ tài liệu, search và màn moderation/admin.
8. Dùng chung tài khoản hiện tại và xác thực hiện tại; backend authorization bắt buộc. Notification được phân loại riêng ở mục 3.

### Không bao gồm trong MVP mặc định

- Đồng bộ dữ liệu học vụ/enrollment hoặc chặn người dùng theo đăng ký môn (không có integration/data contract trong source).
- Truy cập Forum không cần đăng nhập.
- Reaction/vote/downvote, bookmark/follow cá nhân.
- Push/email notification, realtime Forum, mute/digest và notification preferences.
- Preview/in-browser rendering tài liệu, OCR/full-text search nội dung file.
- S3/object storage, antivirus cloud service hoặc distributed job queue nếu chưa có nền tảng được duyệt.
- Hệ appeal, moderation SLA, reputation/points, gamification, anonymous posting, nhiều cấp reply không giới hạn.

## 3. MUST HAVE / SHOULD HAVE / LATER

| Chức năng | Phân loại đề xuất | Phạm vi MVP cụ thể / lý do | Nguồn xác nhận |
|---|---|---|---|
| Trang chủ Forum | MUST HAVE | Trang riêng, danh mục, topic mới/chưa có trả lời và đường vào tìm kiếm; không biến thành feed Social. | Đề xuất mới |
| Danh mục | MUST HAVE | Admin tạo/sửa/ẩn; hỗ trợ cây parent-child tổng quát; không điền taxonomy CMC chưa có xác nhận. | Đề xuất mới |
| Môn học | MUST HAVE | Admin CRUD; gắn vào category; mã môn tùy chọn/unique khi có; cho phép không có dữ liệu ban đầu. Chưa có enrollment-based access. | Đề xuất mới; dữ liệu chính thức chưa xác nhận |
| Khoa/ngành/đơn vị học thuật | LATER | Hoãn bảng cây học thuật riêng cho đến khi CMC xác nhận cấu trúc và nguồn dữ liệu; không suy diễn từ category. | Chưa đủ dữ liệu |
| Topic câu hỏi | MUST HAVE | Tạo/xem/sửa/xóa mềm; title/body/category; có reply và accepted answer. | Đề xuất mới |
| Topic thảo luận | MUST HAVE | Cùng vòng đời topic/reply nhưng không có accepted answer. | Đề xuất mới |
| Topic chia sẻ tài liệu | MUST HAVE | Loại `RESOURCE`, mô tả và một hoặc nhiều attachment theo quota/file policy đã duyệt. | Đề xuất mới |
| Reply và phản hồi | MUST HAVE | Tạo, sửa, xóa mềm; MVP chỉ reply trực tiếp vào topic (không lồng reply) để giảm scope và đơn giản hóa permission/thread queries. | Đề xuất mới |
| Accepted answer | MUST HAVE | Chỉ trên QUESTION; tác giả topic chọn/bỏ chọn một reply thuộc topic. Admin có thể gỡ theo moderation/audit, không tự nhận thay tác giả trong MVP. | Đề xuất mới |
| Upload/download | MUST HAVE | Upload xác thực; quarantine/status; tải bằng attachment ID qua API có authorization; không public static URL. Không release MVP nếu không thể bảo vệ download. | Đề xuất mới; upload local hiện có nhưng public route không phù hợp trực tiếp |
| Tag | MUST HAVE | Admin quản lý tag chuẩn hóa; topic có nhiều tag; chọn tag từ danh sách. Không cần user tự tạo tag. | Đề xuất mới |
| Tìm kiếm và phân trang | MUST HAVE | Search cơ bản theo title/body và lọc category/course/tag/type/status; phân trang/sort; không gồm tìm toàn văn trong PDF/DOC. | Đề xuất mới; feed hiện chưa có search tổng quát |
| Bookmark | SHOULD HAVE | Lưu topic cá nhân; có thể dùng bảng Forum riêng. Tách khỏi `/saved` cho tới khi chủ dự án quyết định tích hợp. | Đề xuất mới |
| Follow topic | LATER | Hoãn theo dõi tùy chọn để tránh mở rộng notification fan-out trong MVP; nếu sau này bật, recipient phải có quyền xem topic. | Đề xuất mới |
| Reaction/like/vote | LATER | Không cần để hoàn thành hỏi đáp/tài liệu; giảm abuse/moderation và schema ở MVP. | Đề xuất mới |
| Báo cáo nội dung | MUST HAVE | USER báo cáo topic/reply với reason; chống duplicate report đang mở theo user-target; chỉ reporter xem trạng thái của report mình. | Đề xuất mới |
| Kiểm duyệt | MUST HAVE | Hàng đợi report, ẩn/khóa/khôi phục topic/reply, lý do và audit; admin toàn hệ thống, moderator chỉ scope. | Đề xuất mới |
| Moderator scope | MUST HAVE (tối thiểu) | Gán moderator theo category; assignment do ADMIN quản lý, có trạng thái active/revoked. Không mở global moderator hoặc course scope riêng trong MVP. | Đề xuất mới; global role hiện chỉ USER/ADMIN |
| Notification | SHOULD HAVE (nâng thành MUST nếu xác nhận acceptance là có báo phản hồi) | MVP nên có in-app notification cho reply vào topic của user và accepted answer; không email/push/realtime. Dùng `APP_NOTIFICATION` hiện có; không thêm notification table. Chốt điều kiện trước nghiệm thu. | Notification nền tảng đã có trong source; event Forum là mới |
| Quản trị Forum | MUST HAVE | Admin CRUD category/course/tag, gán moderator category, xem report queue toàn hệ thống; không dùng chung admin dashboard Social ngoài quyền ADMIN nếu chưa cần. | Đề xuất mới |
| Theo dõi view/popularity/reputation | LATER | Không cần cho MVP; tránh metric không có định nghĩa/abuse policy. | Đề xuất mới |

### Gating về thông báo

Notification được phân loại **SHOULD HAVE** để giữ MVP nhỏ, nhưng quyết định này phụ thuộc yêu cầu người dùng:

- Nếu chủ dự án yêu cầu tác giả phải biết có câu trả lời/accepted answer, nâng các in-app notification nêu trên thành **MUST HAVE** trước khi đóng API/schema.
- Không tạo notification cho mọi reaction (reaction đang LATER); không gửi email/push trong MVP.

## 4. Quy tắc nghiệp vụ đề xuất

### 4.1 Quyền xem và tạo nội dung

- **Đăng nhập:** mặc định mọi route/API Forum yêu cầu đăng nhập bằng account hiện tại. Guest không xem được trong đề xuất MVP, vì mặc định này giảm rủi ro rò rỉ học liệu. Nếu muốn public read, cần phê duyệt riêng và thiết kế endpoint/cache/CORS.
- **Xem:** USER được xem category/course active và topic `PUBLISHED` hoặc `LOCKED`; topic `HIDDEN`/`DELETED` không xuất hiện trong list/search/count. Không có enrollment data trong source, do đó MVP không giả vờ giới hạn theo sinh viên đã đăng ký môn.
- **Tạo topic:** USER đang authenticated và không bị khóa tài khoản, thuộc category active; course nếu có phải active và liên kết category hợp lệ. Hệ thống không có Forum-specific ban trong source; nếu cần giới hạn user vi phạm, chủ dự án cần chọn policy.
- **Tạo reply:** USER có quyền xem topic và topic `PUBLISHED`; `LOCKED` chỉ đọc. Reply trực tiếp topic; không tạo reply khi topic `HIDDEN`/`DELETED`.
- **Sửa topic/reply:** chủ sở hữu được sửa nội dung của mình khi trạng thái còn hoạt động; MVP chưa đặt thời hạn sửa. Moderator/admin không sửa thay tác giả mà thực hiện ẩn/khôi phục/khóa và ghi audit.
- **Xóa topic/reply:** chủ sở hữu yêu cầu xóa theo soft-delete; FK, report và audit không bị xóa dây chuyền. Moderator/admin có thể ẩn nội dung vì policy, khác với xóa mềm do tác giả.
- **Accepted answer:** chỉ tác giả topic `QUESTION` chọn/bỏ chọn reply của chính topic. Một topic tối đa một accepted answer. Moderator không tự chọn answer; ADMIN có thể gỡ trạng thái nếu có lý do moderation và audit.
- **Tag:** USER chỉ chọn tag đang active; admin tạo/đổi trạng thái. Tên/slug phải unique theo quy ước normalize được duyệt.
- **Bookmark:** SHOULD HAVE; nếu bật, record chỉ thuộc user hiện hành và target phải đọc được. **Follow:** LATER; chỉ bổ sung cùng notification recipient policy được duyệt.

### 4.2 Quy tắc moderator/admin

- **Moderator:** assignment active theo một hoặc nhiều category cụ thể; quyền chỉ bao gồm xem report và ẩn/khôi phục/khóa/mở khóa topic/reply thuộc scope được gán. Moderator không quản trị category/course/tag, không gán moderator, không mở nội dung ở ngoài scope.
- **Admin:** `Role.ADMIN` hiện có; quản lý taxonomy, tag, assignment, mọi report và moderation toàn Forum. Mọi hành động moderator/admin ghi actor, action, target, reason và timestamp.
- Admin có thể truy cập nội dung ẩn khi cần kiểm duyệt theo quyền quản trị. Việc đọc file private để xử lý phải được ghi audit nếu policy yêu cầu; không tạo URL permanent/public.
- **Backend là nguồn quyết định quyền:** `@CurrentUser`/SecurityContext, owner, status, target category và moderator assignment được kiểm tra trong service cho từng request. Ẩn nút trên frontend không phải authorization.

### 4.3 Trạng thái topic, reply và file

| Đối tượng/trạng thái | Hành vi |
|---|---|
| Topic `PUBLISHED` | Hiển thị cho user có quyền; cho phép reply/upload theo policy. |
| Topic `LOCKED` | Vẫn đọc được cho user có quyền; không nhận reply, reaction hoặc attachment mới. Download attachment `AVAILABLE` vẫn được phép cho user có quyền đọc topic, trừ khi moderator thu hồi file. |
| Topic `HIDDEN` | Không hiện trong public-forum list/search/count. USER thường không đọc detail/attachment; chủ nội dung không bypass ẩn. Moderator/admin trong scope có thể xem để moderation. |
| Topic `DELETED` | Soft-delete, không hiện cho USER; replies/attachments giữ metadata/audit. Tải file bị từ chối cho USER; không cascade delete row. |
| Reply `HIDDEN`/`DELETED` | Không hiển thị/tải attachment cho USER. Topic cha có thể vẫn xem được; không cho phép reply đó tham gia accepted-answer hoặc reply mới. |
| Attachment `PENDING_SCAN` | Không hiển thị download action; không thể tải xuống người dùng cuối. |
| Attachment `AVAILABLE` | Download chỉ sau kiểm tra access ở request hiện tại, target còn hợp lệ/được đọc và attachment chưa revoked. |
| Attachment `REJECTED`/`REVOKED`/`DELETED` | Không tải được. Metadata có thể giữ cho moderator/audit; bytes được giữ hoặc cleanup theo retention policy đã duyệt. |

Tất cả chuyển trạng thái cần server-side validation và audit phù hợp. Hành vi lưu vật lý file bao lâu sau soft-delete còn **chưa xác định**, nhưng URL/storage key không được dùng để vượt qua quyền.

## 5. Ma trận quyền MVP

| Thao tác | USER | MODERATOR theo category | ADMIN |
|---|---|---|---|
| Xem nội dung active/locked | Có nếu authenticated và policy cho phép | Có như USER; thêm nội dung ẩn trong scope | Toàn Forum |
| Tạo topic/reply/upload | Có trong category active/topic open | Có như USER | Có |
| Sửa/xóa mềm nội dung của mình | Có khi target active | Có như USER | Có |
| Khóa/mở khóa/ẩn/khôi phục topic/reply | Không | Chỉ category scope được gán | Toàn Forum |
| Chọn accepted answer | Là tác giả QUESTION | Không tự chọn thay tác giả | Có thể gỡ/override chỉ với audit; không tự chấp nhận mặc định |
| Tải file | Nếu có quyền đọc target và file AVAILABLE | Theo quyền target/scope; chỉ file của nội dung trong scope | Theo quyền quản trị và audit policy |
| Report nội dung | Có trên nội dung đọc được | Có như USER | Có như USER |
| Xem report queue | Chỉ report của mình, nếu cung cấp status API | Report trong scope | Tất cả |
| Xử lý report | Không | Trong scope | Toàn Forum |
| Quản lý category/course/tag | Không | Không | Có |
| Cấp/thu hồi moderator | Không | Không | Có |

**[CHƯA ĐỦ DỮ LIỆU]** Có cần phân biệt giảng viên khỏi USER, có enrollment hay group membership làm policy đọc, và ADMIN có được xem private resource ngoài mục đích moderation hay không.

## 6. Database MVP — đánh giá đủ 14 bảng thiết kế

Tất cả tên bảng và constraint dưới đây là thiết kế, không phải DDL triển khai. Bảng nào có thể để sau được đánh dấu rõ. Bảng Social không sửa đổi; tài khoản Forum FK tới `USERS.user_id`.

| # | Bảng trong thiết kế | MVP | PK/FK/unique/check/index và lưu ý |
|---:|---|---|---|
| 1 | `FORUM_ACADEMIC_UNITS` | LATER | Chỉ thêm khi chủ dự án xác nhận cây khoa/ngành/đơn vị và nguồn quản trị. Khi có: self-FK `parent_unit_id`, FK audit -> USERS; unique code có điều kiện khi code not null; index `(parent_unit_id,status)`. Không đưa danh sách chính thức vào MVP. |
| 2 | `FORUM_CATEGORIES` | MUST | PK `category_id`; self-FK parent nullable; FK `created_by/updated_by` -> USERS; unique slug; CHECK không self-parent (cycle nhiều cấp cần service); index `(parent_category_id,status,sort_order)`, unique slug theo normalization/collation đã chốt. |
| 3 | `FORUM_COURSES` | MUST | PK `course_id`; FK category; FK creator/updater -> USERS; optional `course_code` filtered unique khi not null; index `(category_id,status)` và `(course_code)` nếu cần. Không gắn `unit_id` cho tới khi bảng academic units được duyệt. |
| 4 | `FORUM_TAGS` | MUST | PK; FK creator -> USERS; unique slug; CHECK/status whitelist; index `(status,name)`; tag inactive không được gán mới, tag cũ không nhất thiết xóa topic association. |
| 5 | `FORUM_TOPICS` | MUST | PK; FK category/course/author/creator/updater -> bảng tương ứng/USERS; CHECK topic_type (`QUESTION`,`DISCUSSION`,`RESOURCE`) và status; index list `(category_id,status,created_at,topic_id)`, `(course_id,status,created_at,topic_id)`, `(author_id,created_at,topic_id)`. Thêm index title/full-text chỉ sau khi chốt search strategy. |
| 6 | `FORUM_REPLIES` | MUST | PK; FK topic, author/audit -> USERS/topic; MVP `parent_reply_id` không dùng (hoặc bỏ khỏi schema MVP); CHECK status; filtered unique `topic_id WHERE is_accepted=1`; index `(topic_id,status,created_at,reply_id)`. CHECK accepted chỉ hỗ trợ tối đa một reply; topic type và quan hệ reply-topic cần Service kiểm tra. |
| 7 | `FORUM_TOPIC_TAGS` | MUST | Composite PK `(topic_id,tag_id)`; FK topic/tag/created_by -> bảng tương ứng/USERS; index `(tag_id,topic_id)`; ngăn duplicate gắn tag. |
| 8 | `FORUM_ATTACHMENTS` | MUST | MVP gắn file vào topic/resource, chưa upload file trên reply; PK; FK topic và uploaded_by -> topic/USERS; unique storage key; CHECK size > 0 và status/scan enum; index `(topic_id,status)`, `(uploaded_by,created_at)`. Bổ sung FK reply chỉ khi duyệt attachment trên reply. |
| 9 | `FORUM_TOPIC_FOLLOWS` | LATER | Composite PK/unique `(topic_id,user_id)`; FK topic/user -> USERS; index `(user_id,created_at)`. Chỉ đưa vào khi follow/notification scope được duyệt. |
| 10 | `FORUM_BOOKMARKS` | SHOULD | Composite PK `(topic_id,user_id)`; FK topic/user; index `(user_id,created_at)` phục vụ trang đã lưu. Có thể hoãn nếu gấp; nếu lưu MVP, giữ bảng riêng không sửa `SAVED_ITEMS`. |
| 11 | `FORUM_REACTIONS` | LATER | Chưa tạo cho MVP. Khi cần: FK user/target, CHECK đúng một target, filtered unique `(topic_id,user_id)` hoặc `(reply_id,user_id)`, CHECK reaction type, index target. |
| 12 | `FORUM_REPORTS` | MUST | PK; FK reporter/assignee -> USERS, target topic/reply; CHECK đúng một target; CHECK status/reason; index `(status,created_at,report_id)`, `(assigned_to,status,created_at)`, target columns. Unique active duplicate report không biểu đạt đơn giản bằng unique `reporter,target` nếu cho report lại sau khi close; service xử lý hoặc filtered index phù hợp sau khi chốt status model. |
| 13 | `FORUM_MODERATOR_SCOPES` | MUST | PK `scope_id`; FK user/granted_by -> USERS, category -> `FORUM_CATEGORIES`; MVP category scope only, không global scope/course scope; status/revoked_at; unique active assignment `(user_id,category_id)` (filtered index nếu giữ lịch sử revoke); index `(user_id,status)`, `(category_id,status)`. |
| 14 | `FORUM_MODERATION_ACTIONS` | MUST | PK; FK actor -> USERS, target topic/reply, optional report -> bảng tương ứng; CHECK đúng target/action shape; index `(topic_id,created_at)`, `(reply_id,created_at)`, `(report_id,created_at)`, `(actor_id,created_at)`. Append-only theo policy; không hard-delete audit thông thường. |

### Tổng kết schema MVP

- **MUST:** 10 bảng — `FORUM_CATEGORIES`, `FORUM_COURSES`, `FORUM_TAGS`, `FORUM_TOPICS`, `FORUM_REPLIES`, `FORUM_TOPIC_TAGS`, `FORUM_ATTACHMENTS`, `FORUM_REPORTS`, `FORUM_MODERATOR_SCOPES`, `FORUM_MODERATION_ACTIONS`.  
- **SHOULD:** `FORUM_BOOKMARKS` (1 bảng).
- **LATER:** `FORUM_ACADEMIC_UNITS`, `FORUM_TOPIC_FOLLOWS`, `FORUM_REACTIONS` (3 bảng).

> **Đếm chính xác:** MUST 10 + SHOULD 1 + LATER 3 = 14 bảng thiết kế. `APP_NOTIFICATION` đã tồn tại và được tái dùng, không tính là bảng Forum mới.

Nếu chưa chốt upload scanning, không được đánh dấu attachment là `AVAILABLE` ngay một cách mặc định thiếu kiểm tra; phải có policy chấp thuận cho scan synchronous/controlled quarantine. Không triển khai bảng/module chỉ để tạo sẵn dữ liệu giả.

### Constraint và invariant cần xử lý

**Nên enforce trong SQL Server nếu khả thi:**

- PK, FK tới `USERS.user_id` và quan hệ Forum; unique slug/category, tag slug, optional course code; composite PK ở join tables.
- CHECK enum/status/type, `size_bytes > 0`, exactly-one target ở attachment/report/moderation nếu lưu hai FK nullable.
- Filtered unique index để một topic tối đa một accepted reply; một reaction/user/target nếu reaction được bật sau này.
- Index hỗ trợ filter + sort pagination; dùng tie-breaker ổn định `created_at, id`, tránh page bị không ổn định khi cùng thời điểm.

**Bắt buộc kiểm tra trong Service/transaction (không thể dựa riêng vào FK/CHECK):**

- Topic course phải thuộc category topic và course/category active lúc tạo.
- Parent category/unit không tạo cycle; MVP category tree phải giới hạn depth nếu UI/backend chưa hỗ trợ đệ quy sâu.
- Accepted reply thuộc chính topic `QUESTION`; thao tác accept/unaccept phải serialize/transaction để tránh hai accepted concurrent.
- Reporter chưa có report cùng target đang mở; xử lý race bằng constraint phù hợp hoặc transaction/retry/error conflict.
- Moderator assignment active bao phủ category của target; đổi category topic phải revalidate quyền và assignment.
- Chỉ reply khi topic open; update/delete ownership; topic/reply/file status transitions hợp lệ.
- Metadata file được phục vụ chỉ khi user có quyền xem target, file AVAILABLE, target không bị hidden/deleted; ID attachment không phải quyền truy cập.
- Không cascade delete hard-delete các bảng lưu audit/report/attachment; cleanup bytes có retention riêng.

**Tìm kiếm/index:** SQL Server index thường không thay thế full-text search. MVP dùng pagination + filter, index status/category/course/date; full-text body/title chỉ bật sau khi kiểm tra edition/config vận hành SQL Server và yêu cầu ranking. Không dùng query unbounded hoặc N+1 để đếm reply/attachment.

### Lưu ý chỉnh thiết kế 14 bảng trước DDL

1. Thiết kế tổng thể ban đầu có `FORUM_ACADEMIC_UNITS` và `FORUM_COURSES.unit_id`; nếu academic units bị hoãn, bỏ FK/unit column khỏi migration MVP rồi bổ sung additive sau khi duyệt.
2. Thiết kế ban đầu dùng `FORUM_REPLIES.parent_reply_id`; MVP đề xuất flat replies, hoãn nested reply để tránh phức tạp quyền và pagination.
3. `FORUM_MODERATOR_SCOPES` ban đầu hỗ trợ global/category/course; MVP giới hạn category scope, bỏ global/course assignment.
4. `FORUM_ATTACHMENTS` trong thiết kế tổng thể có hai FK target; MVP chỉ cần gắn file vào topic/resource. Bỏ FK reply khỏi migration MVP; bổ sung sau nếu chấp thuận upload tài liệu đính kèm reply.
5. `FORUM_MODERATION_ACTIONS` và `FORUM_REPORTS` cần quy định rõ FK nullable/action target và chính sách lưu audit trước khi schema review.

## 7. Quyết định còn chờ chủ dự án

Các điểm sau là blocker/decision cần ghi nhận trước khi đóng acceptance criteria và thiết kế migration:

1. **Phân loại nội dung và scope:** đồng ý `QUESTION`, `DISCUSSION`, `RESOURCE`; reply flat và accepted answer chỉ cho câu hỏi?
2. **Access:** có thể dùng default “mọi user đăng nhập xem topic active” hay bắt buộc theo enrollment/lớp? Có public read?
3. **Taxonomy:** category generic + course là đủ cho MVP? Academic unit/khoa/ngành có source data chính thức nào không?
4. **Quyền người tạo:** chủ topic có được xóa/sửa vô thời hạn? Khi topic đã có accepted answer/report/file thì có giới hạn?
5. **Accepted answer:** chỉ tác giả question được chọn? Admin có quyền gỡ/override; có cần moderator override?
6. **File:** loại file chính xác, MB/file, tổng số file/topic, quota/user, scanning/quarantine, storage backend, retention/backup.
7. **Download:** attachment của topic LOCKED có tiếp tục tải? Admin/moderator xem/download file khi target HIDDEN trong điều kiện audit nào?
8. **Moderation:** report reason/status, SLA, ai được xem report status, có appeal/ban user không? MVP moderator chỉ category scope có phù hợp?
9. **Tag/search:** tag do admin quản lý có đủ? Search body cần SQL Server Full-Text Search hay search đơn giản được chấp nhận?
10. **Bookmark/follow/notification:** có nâng SHOULD HAVE lên MUST không? Có yêu cầu notice phản hồi bắt buộc?
11. **Tích hợp Saved:** bookmark Forum có cần xuất hiện trong màn `/saved`?
12. **Migration:** ai sở hữu schema production và quy trình duyệt/backup? Chọn versioned SQL hay cho phép thêm migration tool sau khi phê duyệt?
13. **Nghiệm thu:** số lượng dữ liệu/file, accessibility, supported devices, performance target, pilot users.

## 8. Thứ tự phát triển và tiêu chí nghiệm thu

Thứ tự giữ các mốc yêu cầu nhưng thêm **Phase 0** làm điều kiện tiên quyết. Taxonomy và moderation scope cần tồn tại trước topic; attachment phải có target/topic authorization; search nên hoàn thiện sau khi có dữ liệu topic/tag; notification không được đi trước quyết định recipient/privacy.

### Phase 0 — Chốt policy và chuẩn bị an toàn (tiên quyết)

- **Công việc:** duyệt các quyết định ở mục 7; inventory schema SQL Server read-only; xác nhận backup/restore và migration owner; quyết định cách tránh `ddl-auto=update`/`sql.init.mode=always` tự tác động schema mới ở môi trường triển khai. Không dùng `schema.sql` hiện có để cập nhật database.
- **Nghiệm thu:** có decision record về auth/access, taxonomy, file policy, moderator, schema owner; có schema snapshot môi trường và bằng chứng restore test; migration plan review được.
- **Phụ thuộc:** không bắt đầu DDL/persistence Forum nếu chưa qua gate.

### Phase 1 — Forum taxonomy

- **Công việc:** category CRUD/admin, course CRUD/admin, tag CRUD/admin; hierarchy generic; dữ liệu ban đầu rỗng nếu chưa có nguồn chính thức. Frontend home/category/course landing.
- **Kiểm thử:** parent không cycle; slug/code unique policy; course-category consistency; inactive taxonomy không dùng tạo topic; API chỉ ADMIN sửa taxonomy.
- **Nghiệm thu:** admin có thể tạo cấu trúc đã duyệt qua UI/API; user thấy category/course active; không chứa danh sách khoa/ngành/môn không xác thực.

### Phase 2 — Topic và reply

- **Công việc:** topic QUESTION/DISCUSSION; create/detail/list basic; flat replies; edit/soft-delete; accepted answer; status open/locked/hidden/deleted; permission owner/admin/moderator. Khai báo loại RESOURCE trong domain/API chỉ khi phase 3 đã sẵn sàng upload an toàn; trước đó không cho phát hành RESOURCE thiếu file policy.
- **Kiểm thử:** invalid type/status; actor spoof; owner isolation; locked topic không reply; hidden/deleted không lộ; accepted chỉ QUESTION và reply cùng topic; concurrency accepted.
- **Nghiệm thu:** user tạo QUESTION/DISCUSSION, câu hỏi có reply và tối đa một accepted answer; RESOURCE chỉ được nghiệm thu cùng phase 3; hoạt động không làm thay đổi Social routes/data; kiểm thử backend security pass.

### Phase 3 — Tài liệu và quyền download

- **Công việc:** attachment metadata, allowlist và limits đã duyệt, private storage interface, quarantine/scan status, download controller stream qua attachment ID.
- **Kiểm thử:** extension/MIME mismatch, filename traversal, quá limit, unavailable scan status, user không có quyền, hidden/deleted/locked target, không rò storage key/path, cleanup khi DB transaction thất bại.
- **Nghiệm thu:** người dùng có quyền thấy tên/format/size/uploader; file chỉ tải được khi target cho phép và attachment AVAILABLE; URL đoán được không bypass auth.
- **Gate:** nếu chưa có scanning, chủ dự án phải phê duyệt policy MVP và trạng thái an toàn thay thế trước release.

### Phase 4 — Tag, tìm kiếm và phân trang

- **Công việc:** chọn tags, filter category/course/type/tag/status, title/body search basic, sort stable, page/size validation.
- **Kiểm thử:** tag inactive, query rỗng/đặc biệt, kết quả private/hidden không rò; pagination không duplicate/miss khi tie timestamp; query plan/index trên SQL Server.
- **Nghiệm thu:** search/filter trả đúng page contract, giới hạn page size, không tải toàn bộ dataset; không tuyên bố full-text file search.

### Phase 5 — Bookmark và follow

- **Phân loại:** bookmark SHOULD; follow LATER theo bảng tổng kết (có thể nâng lên nếu chủ dự án chọn).
- **Công việc:** chỉ triển khai bookmark khi đã chốt UI Saved; follow chỉ sau khi có notification recipient rule. Không làm hai chức năng mặc định cùng lúc chỉ vì cùng là relation user-topic.
- **Kiểm thử:** unique user-topic, chỉ actor hiện tại có thể add/remove, hidden/deleted target không xuất hiện trong user list.
- **Nghiệm thu:** nếu được bật, thao tác idempotent hoặc trả conflict contract rõ; list user không lẫn dữ liệu người khác.

### Phase 6 — Report và moderation

- **Công việc:** report topic/reply; report queue; category-scoped moderator assignment; lock/hide/restore; append-only action audit; quyền ADMIN toàn cục.
- **Kiểm thử:** duplicate open reports; user xem/giải quyết report của mình; moderator ngoài scope bị 403/404; revoked assignment hết hiệu lực; action và reason audit.
- **Nghiệm thu:** report được xử lý từ UI; trạng thái nội dung và quyền file nhất quán; moderator chỉ thao tác trong scope; admin quản trị assignment.

### Phase 7 — Notification

- **Phụ thuộc:** quyết định notification MUST/SHOULD; event types, recipient privacy, transactional behavior.
- **Công việc:** tích hợp `APP_NOTIFICATION`/`NotificationService` hiện tại; deep link Forum; no self-notification/dedupe; cập nhật unread UI.
- **Kiểm thử:** nhận đúng author/follower được quyền, không leak hidden/private, không duplicate, unread/read dùng API hiện tại.
- **Nghiệm thu:** nếu bật, notification hoạt động in-app; không cần push/email/realtime cho MVP.

### Phase 8 — Frontend hoàn thiện và regression

- **Công việc:** hoàn chỉnh `/forum` navigation/layout, responsive, accessible empty/loading/error states; Home, taxonomy, topic list/detail/editor/resource, search, admin/moderation. Giữ nguyên route Social và global auth.
- **Kiểm thử:** route guard UX; API authorization độc lập với UI; keyboard/accessibility; responsive; file upload error/progress; regression auth/refresh, feed, groups, chat, saved, event, notification, video, admin.
- **Nghiệm thu:** Social Network hoạt động không đổi; Forum có bản sắc học thuật riêng; không còn đường tải file public/bypass; CI/test suite dự án được duyệt pass.

### Cổng release

MVP chưa sẵn sàng phát hành nếu bất kỳ điều kiện nào sau đây chưa đạt:

- Migration chưa được review/backup/restore-test, hoặc schema vẫn có nguy cơ tự thay đổi không kiểm soát khi startup.
- File tài liệu chưa có access control mỗi download và policy file đã duyệt.
- Có lỗi phân quyền/IDOR hoặc nội dung hidden/private xuất hiện trong search/count/notification.
- Chưa regression các chức năng Social quan trọng.
- Chủ dự án chưa chốt các quyết định blocker về data taxonomy, access, file, moderator và notification scope.

## 9. Ghi chú thực hiện giai đoạn

Tài liệu này chỉ chốt **đề xuất phạm vi** và liệt kê quyết định còn mở. Không cập nhật schema, tạo DDL, thêm code, thay cấu hình, chạy migration hoặc cài dependency. Database production và các thiết lập vận hành thực tế vẫn **chưa xác định**.
