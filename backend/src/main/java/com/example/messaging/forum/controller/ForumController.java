package com.example.messaging.forum.controller;

import com.example.messaging.entity.User;
import com.example.messaging.forum.entity.ForumAttachment;
import com.example.messaging.forum.entity.ForumBookmark;
import com.example.messaging.forum.entity.ForumCategory;
import com.example.messaging.forum.entity.ForumCourse;
import com.example.messaging.forum.entity.ForumFaculty;
import com.example.messaging.forum.entity.ForumMajor;
import com.example.messaging.forum.entity.ForumReply;
import com.example.messaging.forum.entity.ForumReport;
import com.example.messaging.forum.entity.ForumTopic;
import com.example.messaging.forum.repository.ForumAttachmentRepository;
import com.example.messaging.forum.repository.ForumBookmarkRepository;
import com.example.messaging.forum.repository.ForumCategoryRepository;
import com.example.messaging.forum.repository.ForumCourseRepository;
import com.example.messaging.forum.repository.ForumFacultyRepository;
import com.example.messaging.forum.repository.ForumMajorRepository;
import com.example.messaging.forum.repository.ForumReplyRepository;
import com.example.messaging.forum.repository.ForumReportRepository;
import com.example.messaging.forum.repository.ForumTopicRepository;
import com.example.messaging.repository.UserRepository;
import com.example.messaging.security.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@RestController
@RequestMapping("/api/forum")
@RequiredArgsConstructor
@Validated
public class ForumController {
    private static final String PUBLISHED = "PUBLISHED";
    private static final Set<String> VISIBLE_STATUSES = Set.of(PUBLISHED, "PENDING");
    private static final Set<String> TOPIC_TYPES = Set.of(
            "QUESTION", "DISCUSSION", "PROJECT", "EXPERIENCE", "KNOWLEDGE", "RESOURCE");
    private static final Set<String> RESOURCE_KINDS = Set.of(
            "CURRICULUM", "STUDY_MATERIAL", "EXAM", "LECTURE", "REFERENCE");

    private final ForumTopicRepository topics;
    private final ForumReplyRepository replies;
    private final ForumCategoryRepository categories;
    private final ForumCourseRepository courses;
    private final ForumFacultyRepository faculties;
    private final ForumMajorRepository majors;
    private final ForumBookmarkRepository bookmarks;
    private final ForumReportRepository reports;
    private final ForumAttachmentRepository attachments;
    private final UserRepository users;

    public record TopicRequest(
            @NotBlank @Size(max = 180) String title,
            @NotBlank @Size(max = 30000) String content,
            @NotBlank String type,
            Long categoryId,
            Long courseId,
            Long facultyId,
            Long majorId,
            String resourceKind,
            @Size(max = 500) String source) {
    }

    public record ReplyRequest(@NotBlank @Size(max = 10000) String content) {
    }

    private User user(Long id) {
        return users.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }

    private ForumTopic visibleTopic(Long id) {
        return topics.findById(id)
                .filter(topic -> VISIBLE_STATUSES.contains(topic.getStatus()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private void requireAuthor(ForumTopic topic, Long userId) {
        if (!topic.getAuthor().getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn chỉ có thể chỉnh sửa bài viết của mình");
        }
    }

    private Map<String, Object> view(ForumTopic topic) {
        Map<String, Object> data = new HashMap<>();
        data.put("id", topic.getId());
        data.put("title", topic.getTitle());
        data.put("content", topic.getContent());
        data.put("type", topic.getType());
        data.put("status", topic.getStatus());
        data.put("authorId", topic.getAuthor().getUserId());
        data.put("authorName", Optional.ofNullable(topic.getAuthor().getDisplayName())
                .orElse(topic.getAuthor().getUsername()));
        data.put("authorAvatar", topic.getAuthor().getAvatar());
        data.put("categoryId", topic.getCategory() == null ? null : topic.getCategory().getId());
        data.put("category", topic.getCategory() == null ? "" : topic.getCategory().getName());
        data.put("courseId", topic.getCourse() == null ? null : topic.getCourse().getId());
        data.put("course", topic.getCourse() == null ? "" : topic.getCourse().getName());
        data.put("resourceKind", topic.getResourceKind());
        data.put("facultyId", topic.getFaculty() == null ? null : topic.getFaculty().getId());
        data.put("faculty", topic.getFaculty() == null ? "" : topic.getFaculty().getName());
        data.put("majorId", topic.getMajor() == null ? null : topic.getMajor().getId());
        data.put("major", topic.getMajor() == null ? "" : topic.getMajor().getName());
        data.put("source", topic.getSource() == null ? "" : topic.getSource());
        data.put("viewCount", topic.getViewCount());
        data.put("replyCount", replies.countByTopicId(topic.getId()));
        data.put("createdAt", topic.getCreatedAt().toString());
        data.put("updatedAt", topic.getUpdatedAt() == null ? null : topic.getUpdatedAt().toString());
        return data;
    }

    @GetMapping("/taxonomy")
    public Map<String, Object> taxonomy() {
        return Map.of(
                "categories", categories.findByActiveTrueOrderByNameAsc().stream()
                        .map(category -> Map.of("id", category.getId(), "name", category.getName(),
                                "description", Optional.ofNullable(category.getDescription()).orElse("")))
                        .toList(),
                "courses", courses.findByActiveTrueOrderByNameAsc().stream()
                        .map(course -> Map.of("id", course.getId(), "code", course.getCode(), "name", course.getName()))
                        .toList(),
                "faculties", faculties.findByActiveTrueOrderByNameAsc().stream()
                        .map(faculty -> Map.of("id", faculty.getId(), "name", faculty.getName()))
                        .toList(),
                "majors", majors.findByActiveTrueOrderByNameAsc().stream()
                        .map(major -> Map.of("id", major.getId(), "name", major.getName(),
                                "facultyId", major.getFaculty().getId()))
                        .toList());
    }

    @GetMapping("/topics")
    public Map<String, Object> list(
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "") String type,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) Long courseId,
            @RequestParam(required = false) Long facultyId,
            @RequestParam(required = false) Long majorId,
            @RequestParam(defaultValue = "newest") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size) {
        if (page < 0 || size < 1 || size > 30 || q.length() > 200) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tham số tìm kiếm hoặc phân trang không hợp lệ");
        }
        if (!type.isBlank() && !TOPIC_TYPES.contains(type)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Loại chủ đề không hợp lệ");
        }
        Sort ordering = switch (sort) {
            case "newest" -> Sort.by(Sort.Direction.DESC, "createdAt");
            case "popular" -> Sort.by(Sort.Direction.DESC, "viewCount").and(Sort.by(Sort.Direction.DESC, "createdAt"));
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cách sắp xếp không hợp lệ");
        };
        Pageable pageable = PageRequest.of(page, size, ordering);

        Specification<ForumTopic> specification = (root, query, builder) ->
                root.get("status").in(VISIBLE_STATUSES);
        if (!q.isBlank()) {
            String pattern = "%" + q.trim().toLowerCase() + "%";
            specification = specification.and((root, query, builder) ->
                    builder.or(
                            builder.like(builder.lower(root.get("title")), pattern),
                            builder.like(builder.lower(root.get("content")), pattern)));
        }
        if (!type.isBlank()) {
            specification = specification.and((root, query, builder) ->
                    builder.equal(root.get("type"), type));
        }
        if (categoryId != null) {
            specification = specification.and((root, query, builder) ->
                    builder.equal(root.get("category").get("id"), categoryId));
        }
        if (courseId != null) {
            specification = specification.and((root, query, builder) ->
                    builder.equal(root.get("course").get("id"), courseId));
        }
        if (facultyId != null) {
            specification = specification.and((root, query, builder) ->
                    builder.equal(root.get("faculty").get("id"), facultyId));
        }
        if (majorId != null) {
            ForumMajor major = majors.findById(majorId)
                    .filter(ForumMajor::isActive)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chuyên ngành không tồn tại"));
            if (facultyId != null && !major.getFaculty().getId().equals(facultyId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chuyên ngành không thuộc khoa đã chọn");
            }
            specification = specification.and((root, query, builder) ->
                    builder.equal(root.get("major").get("id"), majorId));
        }

        Page<ForumTopic> result = topics.findAll(specification, pageable);
        return Map.of(
                "items", result.getContent().stream().map(this::view).toList(),
                "page", page,
                "size", size,
                "totalElements", result.getTotalElements(),
                "totalPages", result.getTotalPages());
    }

    @PostMapping("/topics")
    public Map<String, Object> create(@CurrentUser Long userId, @Valid @RequestBody TopicRequest request) {
        validateTopicType(request.type());
        if ("RESOURCE".equals(request.type())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Bài chia sẻ tài liệu phải gửi kèm tệp qua API multipart");
        }
        ForumTopic topic = new ForumTopic();
        topic.setAuthor(user(userId));
        applyRequest(topic, request);
        topic.setStatus(PUBLISHED);
        return view(topics.save(topic));
    }

    @PutMapping("/topics/{id}")
    public Map<String, Object> update(
            @CurrentUser Long userId,
            @PathVariable Long id,
            @Valid @RequestBody TopicRequest request) {
        ForumTopic topic = visibleTopic(id);
        requireAuthor(topic, userId);
        validateTopicType(request.type());
        validateResourceKind(request.type(), request.resourceKind());
        if ("RESOURCE".equals(request.type()) && !attachments.existsByTopicId(topic.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Bài chia sẻ tài liệu bắt buộc phải có tệp đính kèm");
        }
        applyRequest(topic, request);
        return view(topics.save(topic));
    }

    @DeleteMapping("/topics/{id}")
    public ResponseEntity<Void> delete(@CurrentUser Long userId, @PathVariable Long id) {
        ForumTopic topic = visibleTopic(id);
        requireAuthor(topic, userId);
        topic.setStatus("DELETED");
        topics.save(topic);
        return ResponseEntity.noContent().build();
    }

    private void validateTopicType(String type) {
        if (!TOPIC_TYPES.contains(type)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Loại chủ đề không hợp lệ");
        }
    }

    private void validateResourceKind(String type, String resourceKind) {
        if ("RESOURCE".equals(type)
                && (resourceKind == null || !RESOURCE_KINDS.contains(resourceKind))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Loại tài liệu không hợp lệ");
        }
        if (!"RESOURCE".equals(type) && resourceKind != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Chỉ bài chia sẻ tài liệu mới có loại tài liệu");
        }
    }

    private void applyRequest(ForumTopic topic, TopicRequest request) {
        topic.setTitle(request.title().trim());
        topic.setContent(request.content().trim());
        topic.setType(request.type());
        validateResourceKind(request.type(), request.resourceKind());
        topic.setResourceKind(request.resourceKind());
        topic.setSource(request.source() == null ? null : request.source().trim());
        topic.setCategory(request.categoryId() == null ? null : categories.findById(request.categoryId())
                .filter(ForumCategory::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Danh mục không tồn tại")));
        topic.setCourse(request.courseId() == null ? null : courses.findById(request.courseId())
                .filter(ForumCourse::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Môn học không tồn tại")));
        ForumFaculty faculty = request.facultyId() == null ? null : faculties.findById(request.facultyId())
                .filter(ForumFaculty::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Khoa không tồn tại"));
        ForumMajor major = request.majorId() == null ? null : majors.findById(request.majorId())
                .filter(ForumMajor::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chuyên ngành không tồn tại"));
        if (major != null && (faculty == null || !major.getFaculty().getId().equals(faculty.getId()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chuyên ngành không thuộc khoa đã chọn");
        }
        topic.setFaculty(faculty);
        topic.setMajor(major);
    }

    @GetMapping("/topics/{id}")
    public Map<String, Object> detail(@PathVariable Long id) {
        ForumTopic topic = visibleTopic(id);
        topic.setViewCount(topic.getViewCount() + 1);
        topics.save(topic);

        Map<String, Object> data = view(topic);
        data.put("replies", replies.findByTopicIdOrderByCreatedAtAsc(id).stream()
                .map(reply -> replyView(reply))
                .toList());
        data.put("attachments", attachments.findByTopicIdOrderByCreatedAtAsc(id).stream()
                .map(this::attachmentView)
                .toList());
        return data;
    }

    private Map<String, Object> replyView(ForumReply reply) {
        Map<String, Object> data = new HashMap<>();
        data.put("id", reply.getId());
        data.put("content", reply.getContent());
        data.put("authorId", reply.getAuthor().getUserId());
        data.put("author", Optional.ofNullable(reply.getAuthor().getDisplayName())
                .orElse(reply.getAuthor().getUsername()));
        data.put("authorAvatar", reply.getAuthor().getAvatar());
        data.put("createdAt", reply.getCreatedAt().toString());
        return data;
    }

    private Map<String, Object> attachmentView(ForumAttachment attachment) {
        Map<String, Object> data = new HashMap<>();
        data.put("id", attachment.getId());
        data.put("name", attachment.getOriginalName());
        data.put("size", attachment.getSizeBytes());
        data.put("contentType", attachment.getContentType());
        int dot = attachment.getOriginalName().lastIndexOf('.');
        data.put("extension", dot < 0 ? "" : attachment.getOriginalName().substring(dot + 1).toUpperCase());
        data.put("downloadUrl", "/api/forum/attachments/" + attachment.getId() + "/download");
        return data;
    }

    @PostMapping("/topics/{id}/replies")
    public Map<String, Object> reply(
            @CurrentUser Long userId,
            @PathVariable Long id,
            @Valid @RequestBody ReplyRequest request) {
        ForumReply reply = new ForumReply();
        reply.setTopic(visibleTopic(id));
        reply.setAuthor(user(userId));
        reply.setContent(request.content().trim());
        return replyView(replies.save(reply));
    }

    @PostMapping("/topics/{id}/bookmark")
    public ResponseEntity<?> bookmark(@CurrentUser Long userId, @PathVariable Long id) {
        ForumTopic topic = visibleTopic(id);
        if (!bookmarks.existsByUserUserIdAndTopicId(userId, id)) {
            ForumBookmark bookmark = new ForumBookmark();
            bookmark.setUser(user(userId));
            bookmark.setTopic(topic);
            bookmarks.save(bookmark);
        }
        return ResponseEntity.ok(Map.of("saved", true));
    }

    @DeleteMapping("/topics/{id}/bookmark")
    public ResponseEntity<?> unbookmark(@CurrentUser Long userId, @PathVariable Long id) {
        visibleTopic(id);
        bookmarks.findByUserUserIdAndTopicId(userId, id).ifPresent(bookmarks::delete);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/reports")
    public Map<String, Object> report(
            @CurrentUser Long userId,
            @RequestParam Long topicId,
            @RequestParam @NotBlank @Size(max = 500) String reason) {
        ForumReport report = new ForumReport();
        report.setTopic(visibleTopic(topicId));
        report.setReporter(user(userId));
        report.setReason(reason.trim());
        return Map.of("id", reports.save(report).getId(), "status", "OPEN");
    }
}
