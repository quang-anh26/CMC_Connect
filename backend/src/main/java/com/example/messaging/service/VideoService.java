package com.example.messaging.service;

import com.example.messaging.dto.feed.CreatePostRequest;
import com.example.messaging.dto.feed.FeedPostResponse;
import com.example.messaging.dto.video.VideoCardResponse;
import com.example.messaging.dto.video.VideoReportRequest;
import com.example.messaging.dto.video.VideoUpsertRequest;
import com.example.messaging.entity.*;
import com.example.messaging.exception.ApiException;
import com.example.messaging.repository.*;
import com.example.messaging.config.UploadDirectory;
import com.example.messaging.security.VideoMediaTokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.nio.file.Path;
import java.nio.file.Files;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class VideoService {
    private static final Set<String> VIDEO_EXTENSIONS = Set.of("mp4", "webm", "ogg", "mov", "m4v", "avi", "mkv", "mpeg", "mpg", "3gp");

    private final SocialPostRepository postRepository;
    private final VideoSavedRepository savedRepository;
    private final VideoFollowRepository followRepository;
    private final VideoReportRepository reportRepository;
    private final VideoViewRepository viewRepository;
    private final UserService userService;
    private final FeedService feedService;
    private final UploadDirectory uploadDirectory;
    private final VideoMediaTokenService mediaTokenService;
    private final SavedItemRepository savedItemRepository;
    private final SavedService savedService;

    @Transactional(readOnly = true)
    public Page<VideoCardResponse> list(Long viewerId, String keyword, String sort, String filter, int page, int size) {
        boolean popular = sort == null || !"LATEST".equalsIgnoreCase(sort);
        boolean savedOnly = "SAVED".equalsIgnoreCase(filter);
        boolean followingOnly = "FOLLOWING".equalsIgnoreCase(filter);
        return feedService.searchForExplore(keyword, true, popular, savedOnly, followingOnly, viewerId, page, size)
                .map(response -> card(response, viewerId));
    }

    @Transactional
    public VideoCardResponse create(Long authorId, VideoUpsertRequest request) {
        validateVideoUrl(request.imageUrl());
        CreatePostRequest postRequest = new CreatePostRequest();
        postRequest.setContent(request.content() == null ? "" : request.content().trim());
        postRequest.setImageUrl(request.imageUrl().trim());
        postRequest.setMediaType("VIDEO");
        postRequest.setPrivacy(feedService.normalizePrivacy(request.privacy()));
        FeedPostResponse created = feedService.create(authorId, postRequest);
        return card(created, authorId);
    }

    @Transactional
    public VideoCardResponse update(Long postId, Long authorId, VideoUpsertRequest request) {
        SocialPost post = requireVideo(postId);
        requireOwner(post, authorId);
        if (request.imageUrl() != null && !request.imageUrl().isBlank()) {
            validateVideoUrl(request.imageUrl());
            post.setImageUrl(request.imageUrl().trim());
        }
        post.setContent(request.content() == null ? "" : request.content().trim());
        post.setMediaType("VIDEO");
        post.setPrivacy(feedService.normalizePrivacy(request.privacy()));
        return card(feedService.toResponse(post, authorId), authorId);
    }

    @Transactional
    public void delete(Long postId, Long authorId) {
        SocialPost post = requireVideo(postId);
        requireOwner(post, authorId);
        savedRepository.deleteByPostPostId(postId);
        savedItemRepository.deleteByContentTypeAndContentId("VIDEO", postId);
        viewRepository.deleteByPostPostId(postId);
        reportRepository.deleteByPostPostId(postId);
        feedService.delete(postId, authorId);
    }

    @Transactional
    public long recordView(Long postId, Long viewerId) {
        SocialPost post = readableVideo(postId, viewerId);
        LocalDate today = LocalDate.now();
        if (!viewRepository.existsByPostPostIdAndViewerUserIdAndViewedOn(postId, viewerId, today)) {
            viewRepository.save(VideoView.builder().post(post).viewer(userService.getByIdOrThrow(viewerId)).viewedOn(today).build());
            post.setViewCount(post.getViewCount() + 1);
        }
        return post.getViewCount();
    }

    @Transactional
    public boolean toggleSave(Long postId, Long viewerId) {
        readableVideo(postId, viewerId);
        return Boolean.TRUE.equals(savedService.toggle(viewerId,
                new com.example.messaging.dto.saved.SaveItemRequest("VIDEO", postId, null)).get("saved"));
    }

    @Transactional
    public boolean toggleFollow(Long postId, Long viewerId) {
        SocialPost post = readableVideo(postId, viewerId);
        Long creatorId = post.getAuthor().getUserId();
        if (creatorId.equals(viewerId)) throw ApiException.badRequest("Bạn không thể theo dõi chính mình");
        return followRepository.findByFollowerUserIdAndCreatorUserId(viewerId, creatorId).map(follow -> {
            followRepository.delete(follow);
            return false;
        }).orElseGet(() -> {
            followRepository.save(VideoFollow.builder()
                    .follower(userService.getByIdOrThrow(viewerId))
                    .creator(post.getAuthor()).build());
            return true;
        });
    }

    @Transactional
    public void report(Long postId, Long reporterId, VideoReportRequest request) {
        SocialPost post = readableVideo(postId, reporterId);
        if (post.getAuthor().getUserId().equals(reporterId)) throw ApiException.badRequest("Bạn không thể báo cáo video của mình");
        if (reportRepository.existsByPostPostIdAndReporterUserId(postId, reporterId)) {
            throw ApiException.conflict("Bạn đã báo cáo video này");
        }
        reportRepository.save(VideoReport.builder().post(post).reporter(userService.getByIdOrThrow(reporterId))
                .reason(request.reason().trim()).build());
    }

    @Transactional(readOnly = true)
    public Path mediaPath(Long postId, Long viewerId) {
        SocialPost post = readableVideo(postId, viewerId);
        String fileName = post.getImageUrl().substring("/uploads/".length());
        Path directory = uploadDirectory.resolve().toAbsolutePath().normalize();
        Path path = directory.resolve(fileName).normalize();
        if (!path.startsWith(directory) || !Files.isRegularFile(path)) throw ApiException.notFound("Không tìm thấy tệp video");
        return path;
    }

    private VideoCardResponse card(FeedPostResponse response, Long viewerId) {
        return new VideoCardResponse(response,
                savedItemRepository.existsByUserUserIdAndContentTypeAndContentId(viewerId, "VIDEO", response.getPostId()),
            followRepository.existsByFollowerUserIdAndCreatorUserId(viewerId, response.getAuthorId()),
            "/api/videos/" + response.getPostId() + "/media?token=" + mediaTokenService.issue(response.getPostId(), viewerId));
    }

    private SocialPost readableVideo(Long postId, Long viewerId) {
        SocialPost post = requireVideo(postId);
        if (!feedService.canView(post, viewerId)) throw ApiException.notFound("Không tìm thấy video");
        return post;
    }

    private SocialPost requireVideo(Long postId) {
        SocialPost post = postRepository.findById(postId).orElseThrow(() -> ApiException.notFound("Không tìm thấy video"));
        validateVideoUrl(post.getImageUrl());
        return post;
    }

    private void requireOwner(SocialPost post, Long userId) {
        if (!post.getAuthor().getUserId().equals(userId)) throw ApiException.forbidden("Chỉ chủ video mới được sửa hoặc xóa");
    }

    private void validateVideoUrl(String url) {
        if (url == null || !url.startsWith("/uploads/")) throw ApiException.badRequest("Tệp video không hợp lệ");
        String cleanUrl = url.toLowerCase(Locale.ROOT).split("\\?", 2)[0];
        int dot = cleanUrl.lastIndexOf('.');
        if (dot < 0 || !VIDEO_EXTENSIONS.contains(cleanUrl.substring(dot + 1))) {
            throw ApiException.badRequest("Định dạng video không được hỗ trợ");
        }
    }
}