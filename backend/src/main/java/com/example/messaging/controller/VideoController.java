package com.example.messaging.controller;

import com.example.messaging.dto.video.VideoCardResponse;
import com.example.messaging.dto.video.VideoReportRequest;
import com.example.messaging.dto.video.VideoUpsertRequest;
import com.example.messaging.exception.ApiException;
import com.example.messaging.security.CurrentUser;
import com.example.messaging.security.VideoMediaTokenService;
import com.example.messaging.service.FileStorageService;
import com.example.messaging.service.VideoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpRange;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.Map;
import java.util.Locale;
import java.util.Set;
import java.util.List;
import java.nio.file.Path;
import java.nio.file.Files;

@RestController
@RequestMapping("/api/videos")
@RequiredArgsConstructor
public class VideoController {
    private static final Set<String> BROWSER_VIDEO_EXTENSIONS = Set.of("mp4", "webm", "ogg");

    private final VideoService videoService;
    private final FileStorageService fileStorageService;
    private final VideoMediaTokenService mediaTokenService;

    @Value("${app.upload.video-max-file-size-mb:200}")
    private long maxVideoSizeMb;

    @GetMapping
    public ResponseEntity<Page<VideoCardResponse>> list(
            @CurrentUser Long userId,
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "POPULAR") String sort,
            @RequestParam(defaultValue = "ALL") String filter,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "5") int size) {
        return ResponseEntity.ok(videoService.list(userId, q, sort, filter, page, size));
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> upload(@RequestParam("file") MultipartFile file) {
        String filename = file.getOriginalFilename();
        int extensionStart = filename == null ? -1 : filename.lastIndexOf('.');
        String extension = extensionStart < 0 ? "" : filename.substring(extensionStart + 1).toLowerCase(Locale.ROOT);
        if (!BROWSER_VIDEO_EXTENSIONS.contains(extension)) {
            throw ApiException.badRequest("Chỉ hỗ trợ video MP4, WebM hoặc Ogg để phát trên trình duyệt");
        }
        String contentType = file.getContentType();
        if (contentType != null && !contentType.toLowerCase(Locale.ROOT).startsWith("video/")
                && !MediaType.APPLICATION_OCTET_STREAM_VALUE.equalsIgnoreCase(contentType)) {
            throw ApiException.badRequest("Tệp tải lên không được nhận dạng là video");
        }
        return ResponseEntity.ok(Map.of("url", fileStorageService.store(file, maxVideoSizeMb)));
    }

    @PostMapping
    public ResponseEntity<VideoCardResponse> create(@CurrentUser Long userId,
                                                      @Valid @RequestBody VideoUpsertRequest request) {
        return ResponseEntity.ok(videoService.create(userId, request));
    }

    @PutMapping("/{postId}")
    public ResponseEntity<VideoCardResponse> update(@PathVariable Long postId, @CurrentUser Long userId,
                                                      @Valid @RequestBody VideoUpsertRequest request) {
        return ResponseEntity.ok(videoService.update(postId, userId, request));
    }

    @DeleteMapping("/{postId}")
    public ResponseEntity<Void> delete(@PathVariable Long postId, @CurrentUser Long userId) {
        videoService.delete(postId, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{postId}/views")
    public ResponseEntity<Map<String, Long>> view(@PathVariable Long postId, @CurrentUser Long userId) {
        return ResponseEntity.ok(Map.of("viewCount", videoService.recordView(postId, userId)));
    }

    @GetMapping("/{postId}/media")
    public ResponseEntity<StreamingResponseBody> media(@PathVariable Long postId,
                                                       @RequestParam String token,
                                                       @RequestHeader(value = HttpHeaders.RANGE, required = false) String range) {
        final Long viewerId;
        try {
            viewerId = mediaTokenService.viewerId(token, postId);
        } catch (RuntimeException invalidToken) {
            throw ApiException.unauthorized("Liên kết video đã hết hạn hoặc không hợp lệ");
        }
        try {
            Path path = videoService.mediaPath(postId, viewerId);
            long contentLength = Files.size(path);
            String extension = path.getFileName().toString().toLowerCase(Locale.ROOT);
            MediaType contentType = extension.endsWith(".mp4") ? MediaType.valueOf("video/mp4")
                    : extension.endsWith(".webm") ? MediaType.valueOf("video/webm")
                    : extension.endsWith(".ogg") ? MediaType.valueOf("video/ogg")
                    : MediaTypeFactory.getMediaType(path.getFileName().toString())
                            .orElse(MediaType.APPLICATION_OCTET_STREAM);

            long start = 0;
            long length = contentLength;
            HttpStatus status = HttpStatus.OK;
            HttpHeaders headers = new HttpHeaders();
            headers.set(HttpHeaders.ACCEPT_RANGES, "bytes");
            headers.setContentType(contentType);

            if (range != null) {
                final List<HttpRange> ranges;
                try {
                    ranges = HttpRange.parseRanges(range);
                } catch (IllegalArgumentException invalidRange) {
                    return rangeNotSatisfiable(contentLength);
                }
                if (ranges.size() != 1 || contentLength == 0) {
                    return rangeNotSatisfiable(contentLength);
                }
                try {
                    HttpRange requested = ranges.get(0);
                    start = requested.getRangeStart(contentLength);
                    long end = requested.getRangeEnd(contentLength);
                    if (start >= contentLength || end < start) {
                        return rangeNotSatisfiable(contentLength);
                    }
                    length = end - start + 1;
                } catch (IllegalArgumentException invalidRange) {
                    return rangeNotSatisfiable(contentLength);
                }
                status = HttpStatus.PARTIAL_CONTENT;
                headers.set(HttpHeaders.CONTENT_RANGE, "bytes " + start + "-" + (start + length - 1) + "/" + contentLength);
            }

            final long rangeStart = start;
            final long responseLength = length;
            StreamingResponseBody body = output -> {
                try (InputStream input = Files.newInputStream(path)) {
                    input.skipNBytes(rangeStart);
                    byte[] buffer = new byte[8192];
                    long remaining = responseLength;
                    while (remaining > 0) {
                        int bytesRead = input.read(buffer, 0, (int) Math.min(buffer.length, remaining));
                        if (bytesRead < 0) break;
                        output.write(buffer, 0, bytesRead);
                        remaining -= bytesRead;
                    }
                }
            };
            return ResponseEntity.status(status)
                    .headers(headers)
                    .contentLength(responseLength)
                    .body(body);
        } catch (java.io.IOException exception) {
            throw ApiException.notFound("Không thể đọc tệp video");
        }
    }

    private ResponseEntity<StreamingResponseBody> rangeNotSatisfiable(long contentLength) {
        return ResponseEntity.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .header(HttpHeaders.CONTENT_RANGE, "bytes */" + contentLength)
                .build();
    }

    @PostMapping("/{postId}/save")
    public ResponseEntity<Map<String, Boolean>> save(@PathVariable Long postId, @CurrentUser Long userId) {
        return ResponseEntity.ok(Map.of("saved", videoService.toggleSave(postId, userId)));
    }

    @PostMapping("/{postId}/follow")
    public ResponseEntity<Map<String, Boolean>> follow(@PathVariable Long postId, @CurrentUser Long userId) {
        return ResponseEntity.ok(Map.of("following", videoService.toggleFollow(postId, userId)));
    }

    @PostMapping("/{postId}/report")
    public ResponseEntity<Void> report(@PathVariable Long postId, @CurrentUser Long userId,
                                         @Valid @RequestBody VideoReportRequest request) {
        videoService.report(postId, userId, request);
        return ResponseEntity.noContent().build();
    }
}