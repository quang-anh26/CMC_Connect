package com.example.messaging.forum.controller;

import com.example.messaging.entity.User;
import com.example.messaging.forum.entity.ForumAttachment;
import com.example.messaging.forum.entity.ForumCourse;
import com.example.messaging.forum.entity.ForumFaculty;
import com.example.messaging.forum.entity.ForumMajor;
import com.example.messaging.forum.entity.ForumTopic;
import com.example.messaging.forum.repository.ForumAttachmentRepository;
import com.example.messaging.forum.repository.ForumCategoryRepository;
import com.example.messaging.forum.repository.ForumCourseRepository;
import com.example.messaging.forum.repository.ForumFacultyRepository;
import com.example.messaging.forum.repository.ForumMajorRepository;
import com.example.messaging.forum.repository.ForumReplyRepository;
import com.example.messaging.forum.repository.ForumTopicRepository;
import com.example.messaging.repository.UserRepository;
import com.example.messaging.security.CurrentUser;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/forum")
@RequiredArgsConstructor
@Validated
public class ForumFileController {
    private static final long MAX_FILE_SIZE = 50L * 1024 * 1024;
    private static final Set<String> ALLOWED = Set.of(
            "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "zip", "mp4");
    private static final Set<String> TOPIC_TYPES = Set.of(
            "QUESTION", "DISCUSSION", "PROJECT", "EXPERIENCE", "KNOWLEDGE", "RESOURCE");
    private static final Set<String> RESOURCE_KINDS = Set.of(
            "CURRICULUM", "STUDY_MATERIAL", "EXAM", "LECTURE", "REFERENCE");

    private final ForumTopicRepository topics;
    private final ForumAttachmentRepository attachments;
    private final ForumCategoryRepository categories;
    private final ForumCourseRepository courses;
    private final ForumFacultyRepository faculties;
    private final ForumMajorRepository majors;
    private final ForumReplyRepository replies;
    private final UserRepository users;

    @Value("${app.forum.upload-dir:./forum-private-uploads}")
    private String uploadDir;

    @PostMapping(value = "/topics/with-attachment", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public Map<String, Object> createTopic(
            @CurrentUser Long userId,
            @RequestParam @NotBlank @Pattern(regexp = "^[0-9a-fA-F-]{36}$") String submissionKey,
            @RequestParam @NotBlank @Size(max = 180) String title,
            @RequestParam @NotBlank @Size(max = 30000) String content,
            @RequestParam @NotBlank String type,
            @RequestParam(required = false) Long facultyId,
            @RequestParam(required = false) Long majorId,
            @RequestParam(required = false) Long courseId,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) String resourceKind,
            @RequestParam(required = false) @Size(max = 500) String source,
            @RequestParam(required = false) MultipartFile file) {
        var existing = topics.findBySubmissionKey(submissionKey);
        if (existing.isPresent()) {
            ForumTopic saved = existing.get();
            if (!saved.getAuthor().getUserId().equals(userId)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Mã gửi bài đã được sử dụng");
            }
            return topicView(saved);
        }

        if (!TOPIC_TYPES.contains(type)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Loại chủ đề không hợp lệ");
        }
        if ("RESOURCE".equals(type) && (file == null || file.isEmpty())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bài chia sẻ tài liệu bắt buộc có tệp đính kèm");
        }
        if (facultyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cần chọn khoa");
        }
        if ("RESOURCE".equals(type) && !RESOURCE_KINDS.contains(resourceKind)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Loại tài liệu không hợp lệ");
        }
        if (!"RESOURCE".equals(type) && resourceKind != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Chỉ bài chia sẻ tài liệu mới có loại tài liệu");
        }
        validateFacultyMajor(facultyId, majorId);
        if (file != null && !file.isEmpty()) {
            validateFile(file);
        }

        ForumTopic topic = new ForumTopic();
        topic.setAuthor(findUser(userId));
        topic.setTitle(title.trim());
        topic.setContent(content.trim());
        topic.setType(type);
        topic.setStatus("PUBLISHED");
        topic.setSubmissionKey(submissionKey);
        topic.setResourceKind(resourceKind);
        topic.setSource(source == null || source.isBlank() ? null : source.trim());
        topic.setFaculty(findFaculty(facultyId));
        topic.setMajor(findMajor(majorId));
        topic.setCategory(categoryId == null ? null : categories.findById(categoryId)
                .filter(category -> category.isActive())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Danh mục không tồn tại")));
        topic.setCourse(courseId == null ? null : courses.findById(courseId)
                .filter(ForumCourse::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Môn học không tồn tại")));

        Path storedPath = null;
        try {
            ForumAttachment attachment = null;
            if (file != null && !file.isEmpty()) {
                storedPath = storeFile(file);
                attachment = attachment(topic, file, storedPath.getFileName().toString());
            }
            topic = topics.saveAndFlush(topic);
            if (attachment != null) {
                attachment.setTopic(topic);
                attachments.saveAndFlush(attachment);
            }
            return topicView(topic);
        } catch (IOException | RuntimeException error) {
            removeFile(storedPath);
            if (error instanceof ResponseStatusException responseStatusException) {
                throw responseStatusException;
            }
            if (error instanceof IOException ioException) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Không thể lưu tệp đính kèm trên máy chủ", ioException);
            }
            throw (RuntimeException) error;
        }
    }

    @PostMapping(value = "/topics/{topicId}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public Map<String, Object> upload(
            @CurrentUser Long userId,
            @PathVariable Long topicId,
            @RequestParam("file") MultipartFile file) {
        ForumTopic topic = topics.findById(topicId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!topic.getAuthor().getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn chỉ có thể đính kèm tệp vào bài của mình");
        }
        if (!topic.getStatus().equals("PUBLISHED") && !topic.getStatus().equals("PENDING")) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        validateFile(file);

        Path storedPath = null;
        try {
            storedPath = storeFile(file);
            ForumAttachment attachment = attachments.saveAndFlush(attachment(topic, file, storedPath.getFileName().toString()));
            return attachmentView(attachment);
        } catch (IOException | RuntimeException error) {
            removeFile(storedPath);
            if (error instanceof IOException ioException) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Không thể lưu tệp đính kèm trên máy chủ", ioException);
            }
            throw (RuntimeException) error;
        }
    }

    @GetMapping("/attachments/{id}/download")
    public ResponseEntity<Resource> download(@PathVariable Long id) {
        ForumAttachment attachment = attachments.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String status = attachment.getTopic().getStatus();
        if (!status.equals("PUBLISHED") && !status.equals("PENDING")) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        Path root = Paths.get(uploadDir).toAbsolutePath().normalize();
        Path path = root.resolve(attachment.getStoredName()).normalize();
        if (!path.startsWith(root) || !Files.isRegularFile(path)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        Resource resource = new FileSystemResource(path);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(attachment.getOriginalName()).build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .body(resource);
    }

    private void validateFacultyMajor(Long facultyId, Long majorId) {
        if (majorId == null) {
            return;
        }
        ForumMajor major = findMajor(majorId);
        if (facultyId == null || !major.getFaculty().getId().equals(facultyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chuyên ngành không thuộc khoa đã chọn");
        }
    }

    private ForumFaculty findFaculty(Long id) {
        return id == null ? null : faculties.findById(id)
                .filter(ForumFaculty::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Khoa không tồn tại"));
    }

    private ForumMajor findMajor(Long id) {
        return id == null ? null : majors.findById(id)
                .filter(ForumMajor::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chuyên ngành không tồn tại"));
    }

    private User findUser(Long id) {
        return users.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_FILE_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tệp phải có dung lượng từ 1 byte đến 50 MB");
        }
        String originalName = Objects.requireNonNullElse(file.getOriginalFilename(), "file");
        String extension = extensionOf(originalName);
        if (!ALLOWED.contains(extension)) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "Định dạng không được hỗ trợ. Cho phép PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, ZIP, MP4");
        }
        try {
            if (!signatureMatches(extension, file.getBytes())) {
                throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                        "Nội dung tệp không khớp với phần mở rộng ." + extension);
            }
        } catch (IOException error) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể đọc nội dung tệp", error);
        }
    }

    private Path storeFile(MultipartFile file) throws IOException {
        Path root = Paths.get(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(root);
        String extension = extensionOf(Objects.requireNonNullElse(file.getOriginalFilename(), "file"));
        Path destination = root.resolve(UUID.randomUUID() + "." + extension).normalize();
        if (!destination.startsWith(root)) {
            throw new IOException("Invalid upload destination");
        }
        try {
            try (var input = file.getInputStream()) {
                Files.copy(input, destination);
            }
        } catch (IOException error) {
            removeFile(destination);
            throw error;
        }
        return destination;
    }

    private ForumAttachment attachment(ForumTopic topic, MultipartFile file, String storedName) {
        ForumAttachment attachment = new ForumAttachment();
        attachment.setTopic(topic);
        attachment.setOriginalName(safeOriginalName(file.getOriginalFilename()));
        attachment.setStoredName(storedName);
        attachment.setContentType(Objects.requireNonNullElse(file.getContentType(), "application/octet-stream"));
        attachment.setSizeBytes(file.getSize());
        return attachment;
    }

    private String safeOriginalName(String value) {
        String name = Objects.requireNonNullElse(value, "file").replaceAll("[\\r\\n\\\\/]", "_").trim();
        if (name.isBlank()) {
            return "file";
        }
        return name.length() > 255 ? name.substring(name.length() - 255) : name;
    }

    private String extensionOf(String name) {
        int dot = name.lastIndexOf('.');
        return dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private Map<String, Object> attachmentView(ForumAttachment attachment) {
        Map<String, Object> data = new HashMap<>();
        data.put("id", attachment.getId());
        data.put("name", attachment.getOriginalName());
        data.put("size", attachment.getSizeBytes());
        data.put("contentType", attachment.getContentType());
        data.put("extension", extensionOf(attachment.getOriginalName()));
        data.put("downloadUrl", "/api/forum/attachments/" + attachment.getId() + "/download");
        return data;
    }

    private Map<String, Object> topicView(ForumTopic topic) {
        Map<String, Object> data = new HashMap<>();
        data.put("id", topic.getId());
        data.put("title", topic.getTitle());
        data.put("content", topic.getContent());
        data.put("type", topic.getType());
        data.put("resourceKind", topic.getResourceKind());
        data.put("status", topic.getStatus());
        data.put("authorId", topic.getAuthor().getUserId());
        data.put("authorName", Optional.ofNullable(topic.getAuthor().getDisplayName())
                .orElse(topic.getAuthor().getUsername()));
        data.put("facultyId", topic.getFaculty() == null ? null : topic.getFaculty().getId());
        data.put("faculty", topic.getFaculty() == null ? "" : topic.getFaculty().getName());
        data.put("majorId", topic.getMajor() == null ? null : topic.getMajor().getId());
        data.put("major", topic.getMajor() == null ? "" : topic.getMajor().getName());
        data.put("courseId", topic.getCourse() == null ? null : topic.getCourse().getId());
        data.put("course", topic.getCourse() == null ? "" : topic.getCourse().getName());
        data.put("source", topic.getSource() == null ? "" : topic.getSource());
        data.put("createdAt", topic.getCreatedAt() == null ? null : topic.getCreatedAt().toString());
        data.put("viewCount", topic.getViewCount());
        data.put("replyCount", topic.getId() == null ? 0 : replies.countByTopicId(topic.getId()));
        data.put("attachments", topic.getId() == null ? java.util.List.of()
                : attachments.findByTopicIdOrderByCreatedAtAsc(topic.getId()).stream()
                        .map(this::attachmentView).toList());
        return data;
    }

    private void removeFile(Path path) {
        if (path == null) {
            return;
        }
        try {
            Files.deleteIfExists(path);
        } catch (IOException cleanupError) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Không thể dọn tệp tạm sau khi lưu thất bại", cleanupError);
        }
    }

    private boolean signatureMatches(String extension, byte[] bytes) {
        if (bytes.length < 4) {
            return false;
        }
        return switch (extension) {
            case "pdf" -> bytes[0] == '%' && bytes[1] == 'P' && bytes[2] == 'D' && bytes[3] == 'F';
            case "doc", "ppt", "xls" -> bytes.length >= 8
                    && (bytes[0] & 0xff) == 0xd0 && (bytes[1] & 0xff) == 0xcf
                    && (bytes[2] & 0xff) == 0x11 && (bytes[3] & 0xff) == 0xe0
                    && (bytes[4] & 0xff) == 0xa1 && (bytes[5] & 0xff) == 0xb1
                    && (bytes[6] & 0xff) == 0x1a && (bytes[7] & 0xff) == 0xe1;
            case "zip", "docx", "pptx", "xlsx" ->
                    bytes[0] == 'P' && bytes[1] == 'K' && bytes[2] == 3 && bytes[3] == 4;
            case "mp4" -> bytes.length > 8 && bytes[4] == 'f' && bytes[5] == 't'
                    && bytes[6] == 'y' && bytes[7] == 'p';
            default -> false;
        };
    }
}
