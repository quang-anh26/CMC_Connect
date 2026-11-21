package com.example.messaging.service;

import com.example.messaging.dto.feed.CreateCommentRequest;
import com.example.messaging.dto.feed.CreatePostRequest;
import com.example.messaging.dto.feed.FeedCommentResponse;
import com.example.messaging.dto.feed.FeedPostResponse;
import com.example.messaging.dto.feed.PostMediaItem;
import com.example.messaging.dto.feed.PostReactionSummary;
import com.example.messaging.dto.feed.SharedPostResponse;
import com.example.messaging.dto.feed.SharePostRequest;
import com.example.messaging.dto.feed.UpdatePostRequest;
import com.example.messaging.entity.HiddenPostAuthor;
import com.example.messaging.entity.SocialPost;
import com.example.messaging.entity.SocialPostComment;
import com.example.messaging.entity.SocialPostReaction;
import com.example.messaging.entity.User;
import com.example.messaging.exception.ApiException;
import com.example.messaging.repository.HiddenPostAuthorRepository;
import com.example.messaging.repository.SocialPostCommentRepository;
import com.example.messaging.repository.SocialPostReactionRepository;
import com.example.messaging.repository.SocialPostRepository;
import com.example.messaging.repository.FriendRequestRepository;
import com.example.messaging.repository.SavedItemRepository;
import com.example.messaging.entity.enums.FriendRequestStatus;
import com.example.messaging.security.VideoMediaTokenService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FeedService {

    private static final Set<String> VIDEO_EXTENSIONS = Set.of(
            "mp4", "webm", "ogg", "mov", "m4v", "avi", "mkv", "mpeg", "mpg", "3gp");
    private static final Set<String> REACTION_TYPES = Set.of("LIKE", "LOVE", "HAHA", "WOW", "ANGRY");
    private static final Pattern LINK_PATTERN = Pattern.compile("https?://[^\\s<>()]+", Pattern.CASE_INSENSITIVE);

    private final SocialPostRepository postRepository;
    private final HiddenPostAuthorRepository hiddenPostAuthorRepository;
    private final SocialPostReactionRepository reactionRepository;
    private final SocialPostCommentRepository commentRepository;
    private final UserService userService;
    private final FriendRequestRepository friendRequestRepository;
    private final VideoMediaTokenService videoMediaTokenService;
    private final SavedItemRepository savedItemRepository;
    private final NotificationService notificationService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<FeedPostResponse> list(Long viewerId) {
        Set<Long> hiddenAuthorIds = Set.copyOf(hiddenPostAuthorRepository.findHiddenAuthorIdsByViewerId(viewerId));
        return postRepository.findAll().stream()
            .filter(post -> canView(post, viewerId))
                .filter(post -> !hiddenAuthorIds.contains(post.getAuthor().getUserId()))
                .sorted(java.util.Comparator.comparing(
                        SocialPost::getCreatedAt,
                        java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder())))
                .map(post -> toResponse(post, viewerId))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public FeedPostResponse getPost(Long postId, Long viewerId) {
        return toResponse(getReadablePost(postId, viewerId), viewerId);
    }

    @Transactional(readOnly = true)
    public Page<FeedPostResponse> searchPosts(String keyword, boolean videos, boolean popular,
                                              boolean savedOnly, boolean followingOnly,
                                              Long viewerId, int page, int size) {
        String query = keyword == null ? "" : keyword.trim();
        int safePage = Math.max(page, 0);
        int safeSize = Math.max(1, Math.min(size, 30));
        List<Long> friendIds = new java.util.ArrayList<>();
        friendIds.add(viewerId);
        friendRequestRepository.findBySenderUserIdAndStatusOrReceiverUserIdAndStatus(
                viewerId, FriendRequestStatus.ACCEPTED, viewerId, FriendRequestStatus.ACCEPTED)
            .forEach(request -> friendIds.add(request.getSender().getUserId().equals(viewerId)
                ? request.getReceiver().getUserId() : request.getSender().getUserId()));
        return postRepository.searchPosts(query, videos, popular, savedOnly, followingOnly,
                viewerId, friendIds, PageRequest.of(safePage, safeSize))
                .map(post -> toResponse(post, viewerId));
    }

    @Transactional
    public FeedPostResponse create(Long authorId, CreatePostRequest request) {
        String content = request.getContent() == null ? null : request.getContent().trim();
        boolean hasContent = content != null && !content.isBlank();

        // Gom danh sách media: ưu tiên mediaItems (nhiều ảnh/video); nếu không có thì dùng imageUrl/mediaType cũ.
        List<PostMediaItem> media = new ArrayList<>();
        if (request.getMediaItems() != null) {
            for (PostMediaItem item : request.getMediaItems()) {
                if (item == null || item.getUrl() == null || item.getUrl().isBlank()) continue;
                String url = item.getUrl().trim();
                String type = item.getType() == null || item.getType().isBlank()
                        ? resolveMediaType(url) : item.getType().trim().toUpperCase(Locale.ROOT);
                if (!"IMAGE".equals(type) && !"VIDEO".equals(type)) {
                    throw ApiException.badRequest("Loại media không hợp lệ");
                }
                media.add(new PostMediaItem(url, type));
            }
        }
        if (media.isEmpty()) {
            String imageUrl = request.getImageUrl() == null ? null : request.getImageUrl().trim();
            String mediaType = request.getMediaType() == null ? null : request.getMediaType().trim().toUpperCase(Locale.ROOT);
            boolean hasMedia = imageUrl != null && !imageUrl.isBlank();
            if (hasMedia && mediaType != null && !"IMAGE".equals(mediaType) && !"VIDEO".equals(mediaType)) {
                throw ApiException.badRequest("Loại media không hợp lệ");
            }
            if (!hasMedia && mediaType != null) {
                throw ApiException.badRequest("Thiếu ảnh hoặc video cho bài viết");
            }
            if (hasMedia) media.add(new PostMediaItem(imageUrl, mediaType == null ? resolveMediaType(imageUrl) : mediaType));
        }
        if (media.size() > 10) {
            throw ApiException.badRequest("Mỗi bài viết chỉ được đăng tối đa 10 ảnh/video");
        }
        if (!hasContent && media.isEmpty()) {
            throw ApiException.badRequest("Bài viết cần có nội dung hoặc ảnh/video");
        }

        User author = userService.getByIdOrThrow(authorId);
        String privacy = normalizePrivacy(request.getPrivacy());
        PostMediaItem first = media.isEmpty() ? null : media.get(0);
        SocialPost post = postRepository.save(SocialPost.builder()
                .author(author)
                .content(hasContent ? content : "")
                // media đầu tiên vẫn lưu ở imageUrl/mediaType để các chức năng cũ (trang Video, lưu bài...) hoạt động như trước
                .imageUrl(first == null ? null : first.getUrl())
                .mediaType(first == null ? null : first.getType())
                .mediaItems(media.size() > 1 ? writeMedia(media) : null)
                .privacy(privacy)
                .build());
        notifyFriendsAboutPost(post, authorId);
        return toResponse(post, authorId);
    }

    @Transactional
    public FeedPostResponse updatePost(Long postId, Long authorId, UpdatePostRequest request) {
        SocialPost post = getPost(postId);
        if (!post.getAuthor().getUserId().equals(authorId)) {
            throw ApiException.forbidden("Chỉ tác giả mới có thể chỉnh sửa bài viết");
        }
        String content = request.getContent() == null ? "" : request.getContent().trim();
        if (content.isBlank() && post.getImageUrl() == null && post.getSharedPost() == null) {
            throw ApiException.badRequest("Bài viết cần có nội dung hoặc ảnh/video");
        }
        post.setContent(content);
        return toResponse(postRepository.save(post), authorId);
    }

    @Transactional
    public void hideAuthor(Long viewerId, Long authorId) {
        if (viewerId.equals(authorId)) {
            throw ApiException.badRequest("Bạn không thể ẩn bài viết của chính mình");
        }
        User viewer = userService.getByIdOrThrow(viewerId);
        User author = userService.getByIdOrThrow(authorId);
        if (!hiddenPostAuthorRepository.existsByViewerUserIdAndAuthorUserId(viewerId, authorId)) {
            hiddenPostAuthorRepository.save(HiddenPostAuthor.builder().viewer(viewer).author(author).build());
        }
    }

    @Transactional
    public FeedPostResponse updatePrivacy(Long postId, Long authorId, String requestedPrivacy) {
        SocialPost post = getPost(postId);
        if (!post.getAuthor().getUserId().equals(authorId)) {
            throw ApiException.forbidden("Chỉ tác giả mới có thể thay đổi quyền riêng tư bài viết");
        }
        post.setPrivacy(normalizePrivacy(requestedPrivacy));
        return toResponse(postRepository.save(post), authorId);
    }

    @Transactional
    public FeedPostResponse toggleLike(Long postId, Long userId) {
        return setReaction(postId, userId, "LIKE");
    }

    @Transactional
    public FeedPostResponse setReaction(Long postId, Long userId, String reactionType) {
        SocialPost post = getReadablePost(postId, userId);
        User user = userService.getByIdOrThrow(userId);
        String normalizedType = reactionType == null ? "LIKE" : reactionType.trim().toUpperCase(Locale.ROOT);
        if (!REACTION_TYPES.contains(normalizedType)) {
            throw ApiException.badRequest("Loại cảm xúc không hợp lệ");
        }

        var existingReaction = reactionRepository.findByPostPostIdAndUserUserId(postId, userId);
        if (existingReaction.isPresent()) {
            SocialPostReaction reaction = existingReaction.get();
            String currentType = reaction.getReactionType() == null ? "LIKE" : reaction.getReactionType();
            if (currentType.equals(normalizedType)) {
                reactionRepository.delete(reaction);
            } else {
                reaction.setReactionType(normalizedType);
                reactionRepository.save(reaction);
            }
        } else {
            reactionRepository.save(SocialPostReaction.builder()
                    .post(post).user(user).reactionType(normalizedType).build());
            notificationService.create(post.getAuthor().getUserId(), userId, "POST_REACTION", "POST", postId,
                    "đã bày tỏ cảm xúc với bài viết của bạn.");
        }
        return toResponse(post, userId);
    }

    @Transactional
    public FeedPostResponse addComment(Long postId, Long authorId, CreateCommentRequest request) {
        SocialPost post = getReadablePost(postId, authorId);
        User author = userService.getByIdOrThrow(authorId);
        SocialPostComment parentComment = request.getParentCommentId() == null ? null :
            commentRepository.findByCommentIdAndPostPostId(request.getParentCommentId(), postId)
                .orElseThrow(() -> ApiException.badRequest("Bình luận trả lời không thuộc bài viết này"));
        SocialPostComment savedComment = commentRepository.save(SocialPostComment.builder()
                .post(post)
                .author(author)
                .parentComment(parentComment)
                .content(request.getContent().trim())
                .build());
        User recipient = parentComment == null ? post.getAuthor() : parentComment.getAuthor();
        String notificationType = parentComment == null ? "POST_COMMENT" : "COMMENT_REPLY";
        String message = parentComment == null ? "đã bình luận về bài viết của bạn." : "đã trả lời bình luận của bạn.";
        notificationService.create(recipient.getUserId(), authorId, notificationType, "POST", postId, message);
        return toResponse(post, authorId);
    }

    @Transactional
    public FeedPostResponse share(Long postId, Long sharerId, SharePostRequest request) {
        SocialPost target = getReadablePost(postId, sharerId);
        SocialPost original = target.getSharedPost() == null ? target : target.getSharedPost();
        getReadablePost(original.getPostId(), sharerId);
        User sharer = userService.getByIdOrThrow(sharerId);
        String content = request.getContent() == null ? "" : request.getContent().trim();
        SocialPost sharedPost = postRepository.save(SocialPost.builder()
                .author(sharer)
                .content(content)
                .sharedPost(original)
                .privacy(original.getPrivacy() == null ? "PUBLIC" : original.getPrivacy())
                .build());
        notifyFriendsAboutPost(sharedPost, sharerId);
        notificationService.create(original.getAuthor().getUserId(), sharerId, "POST_SHARED", "POST", original.getPostId(),
                "đã chia sẻ bài viết của bạn.");
        return toResponse(sharedPost, sharerId);
    }

    @Transactional
    public void delete(Long postId, Long requesterId) {
        SocialPost post = getPost(postId);
        if (!post.getAuthor().getUserId().equals(requesterId)) {
            throw ApiException.forbidden("Chỉ tác giả mới có thể xóa bài viết");
        }
        postRepository.deleteAll(postRepository.findBySharedPostPostId(postId));
        commentRepository.deleteAllByPostId(postId);
        postRepository.delete(post);
    }

    private SocialPost getPost(Long postId) {
        return postRepository.findById(postId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy bài viết"));
    }

    private void notifyFriendsAboutPost(SocialPost post, Long authorId) {
        if ("PRIVATE".equals(post.getPrivacy())) return;
        friendRequestRepository.findBySenderUserIdAndStatusOrReceiverUserIdAndStatus(
                        authorId, FriendRequestStatus.ACCEPTED, authorId, FriendRequestStatus.ACCEPTED)
                .stream()
                .map(request -> request.getSender().getUserId().equals(authorId)
                        ? request.getReceiver().getUserId() : request.getSender().getUserId())
                .distinct()
                .forEach(friendId -> notificationService.create(friendId, authorId, "POST_CREATED", "POST",
                        post.getPostId(), "đã đăng bài viết mới."));
    }

    private SocialPost getReadablePost(Long postId, Long viewerId) {
        SocialPost post = getPost(postId);
        if (!canView(post, viewerId)) throw ApiException.notFound("Không tìm thấy bài viết");
        return post;
    }

    public boolean canView(SocialPost post, Long viewerId) {
        String privacy = post.getPrivacy() == null ? "PUBLIC" : post.getPrivacy();
        return post.getAuthor().getUserId().equals(viewerId) || "PUBLIC".equals(privacy) ||
                ("FRIENDS".equals(privacy) && friendRequestRepository.areAcceptedFriends(
                        viewerId, post.getAuthor().getUserId()));
    }

    public String normalizePrivacy(String privacy) {
        String normalized = privacy == null || privacy.isBlank() ? "PUBLIC" : privacy.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("PUBLIC", "FRIENDS", "PRIVATE").contains(normalized)) {
            throw ApiException.badRequest("Quyền riêng tư video không hợp lệ");
        }
        return normalized;
    }

    public FeedPostResponse toResponse(SocialPost post, Long viewerId) {
        SocialPostReaction viewerReaction = reactionRepository
            .findByPostPostIdAndUserUserId(post.getPostId(), viewerId).orElse(null);
        List<SocialPostReaction> reactions = reactionRepository.findByPostPostIdOrderByCreatedAtAsc(post.getPostId());
        java.util.Map<String, Long> reactionCounts = reactions.stream().collect(Collectors.groupingBy(
                reaction -> {
                    return reaction.getReactionType() == null ? "LIKE" : reaction.getReactionType();
                },
                java.util.LinkedHashMap::new,
                Collectors.counting()));
        List<PostReactionSummary> reactionSummary = reactionCounts.entrySet().stream()
                .map(entry -> PostReactionSummary.builder().reactionType(entry.getKey())
                        .count(entry.getValue()).build())
                .collect(Collectors.toList());
        List<FeedCommentResponse> comments = commentRepository.findByPostPostIdOrderByCreatedAtAsc(post.getPostId())
                .stream().map(comment -> FeedCommentResponse.builder()
                        .commentId(comment.getCommentId())
                    .parentCommentId(comment.getParentComment() == null ? null : comment.getParentComment().getCommentId())
                        .authorId(comment.getAuthor().getUserId())
                        .authorName(displayName(comment.getAuthor()))
                        .authorAvatar(comment.getAuthor().getAvatar())
                        .content(comment.getContent())
                        .createdAt(comment.getCreatedAt())
                        .build()).collect(Collectors.toList());

        return FeedPostResponse.builder()
                .postId(post.getPostId())
                .authorId(post.getAuthor().getUserId())
                .authorName(displayName(post.getAuthor()))
                .authorAvatar(post.getAuthor().getAvatar())
                .content(post.getContent())
                .imageUrl(playbackUrl(post, viewerId))
                .mediaType(post.getMediaType() == null ? resolveMediaType(post.getImageUrl()) : post.getMediaType())
                .mediaItems(mediaItemsFor(post, viewerId))
                .privacy(post.getPrivacy() == null ? "PUBLIC" : post.getPrivacy())
                .viewCount(post.getViewCount())
                .createdAt(post.getCreatedAt())
                .likeCount(reactionRepository.countByPostPostId(post.getPostId()))
                .likedByViewer(viewerReaction != null)
                .viewerReaction(viewerReaction == null ? null :
                    (viewerReaction.getReactionType() == null ? "LIKE" : viewerReaction.getReactionType()))
                .reactionSummary(reactionSummary)
                .comments(comments)
                .shareCount(postRepository.countBySharedPostPostId(
                        post.getSharedPost() == null ? post.getPostId() : post.getSharedPost().getPostId()))
                .savedByViewer(savedItemRepository.existsByUserUserIdAndContentTypeAndContentId(
                        viewerId, savedType(post), post.getPostId()))
                .sharedPost(post.getSharedPost() == null || !canView(post.getSharedPost(), viewerId)
                    ? null : toSharedPostResponse(post.getSharedPost(), viewerId))
                .build();
    }

    private String savedType(SocialPost post) {
        if ("VIDEO".equalsIgnoreCase(post.getMediaType())) return "VIDEO";
        if (post.getContent() != null && LINK_PATTERN.matcher(post.getContent()).find()) return "LINK";
        return "POST";
    }

    private SharedPostResponse toSharedPostResponse(SocialPost post, Long viewerId) {
        return SharedPostResponse.builder()
                .postId(post.getPostId())
                .authorId(post.getAuthor().getUserId())
                .authorName(displayName(post.getAuthor()))
                .authorAvatar(post.getAuthor().getAvatar())
                .content(post.getContent())
                .imageUrl(playbackUrl(post, viewerId))
                .mediaType(post.getMediaType() == null ? resolveMediaType(post.getImageUrl()) : post.getMediaType())
                .mediaItems(mediaItemsFor(post, viewerId))
                .createdAt(post.getCreatedAt())
                .build();
    }

    private String playbackUrl(SocialPost post, Long viewerId) {
        String mediaType = post.getMediaType() == null ? resolveMediaType(post.getImageUrl()) : post.getMediaType();
        if (!"VIDEO".equals(mediaType) || post.getImageUrl() == null) return post.getImageUrl();
        return "/api/videos/" + post.getPostId() + "/media?token=" + videoMediaTokenService.issue(post.getPostId(), viewerId);
    }

    /** Danh sách media trả về cho client. Bài cũ (chỉ 1 media) cũng trả về danh sách 1 phần tử. */
    private List<PostMediaItem> mediaItemsFor(SocialPost post, Long viewerId) {
        List<PostMediaItem> stored = readMedia(post.getMediaItems());
        if (stored.isEmpty()) {
            if (post.getImageUrl() == null || post.getImageUrl().isBlank()) return List.of();
            String type = post.getMediaType() == null ? resolveMediaType(post.getImageUrl()) : post.getMediaType();
            return List.of(new PostMediaItem(playbackUrl(post, viewerId), type));
        }
        List<PostMediaItem> result = new ArrayList<>();
        for (int i = 0; i < stored.size(); i++) {
            PostMediaItem item = stored.get(i);
            // Media đầu tiên là video thì phát qua đường dẫn có token như cũ; các media còn lại dùng /uploads/ công khai.
            String url = i == 0 ? playbackUrl(post, viewerId) : item.getUrl();
            result.add(new PostMediaItem(url, item.getType()));
        }
        return result;
    }

    private String writeMedia(List<PostMediaItem> media) {
        try {
            return objectMapper.writeValueAsString(media);
        } catch (Exception exception) {
            throw ApiException.badRequest("Không thể lưu danh sách ảnh/video");
        }
    }

    private List<PostMediaItem> readMedia(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<List<PostMediaItem>>() { });
        } catch (Exception exception) {
            return List.of();
        }
    }

    private String resolveMediaType(String mediaUrl) {
        if (mediaUrl == null || mediaUrl.isBlank()) return null;
        String path = mediaUrl.toLowerCase(Locale.ROOT).split("\\?", 2)[0];
        int extensionStart = path.lastIndexOf('.');
        if (extensionStart < 0) return "IMAGE";
        String extension = path.substring(extensionStart + 1);
        return VIDEO_EXTENSIONS.contains(extension) ? "VIDEO" : "IMAGE";
    }

    private String displayName(User user) {
        return user.getDisplayName() == null || user.getDisplayName().isBlank()
                ? user.getUsername() : user.getDisplayName();
    }
}