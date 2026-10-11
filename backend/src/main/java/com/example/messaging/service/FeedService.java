package com.example.messaging.service;

import com.example.messaging.dto.feed.CreateCommentRequest;
import com.example.messaging.dto.feed.CreatePostRequest;
import com.example.messaging.dto.feed.FeedCommentResponse;
import com.example.messaging.dto.feed.FeedPostResponse;
import com.example.messaging.dto.feed.SharedPostResponse;
import com.example.messaging.dto.feed.SharePostRequest;
import com.example.messaging.entity.SocialPost;
import com.example.messaging.entity.SocialPostComment;
import com.example.messaging.entity.SocialPostReaction;
import com.example.messaging.entity.User;
import com.example.messaging.exception.ApiException;
import com.example.messaging.repository.SocialPostCommentRepository;
import com.example.messaging.repository.SocialPostReactionRepository;
import com.example.messaging.repository.SocialPostRepository;
import com.example.messaging.repository.FriendRequestRepository;
import com.example.messaging.repository.SavedItemRepository;
import com.example.messaging.entity.enums.FriendRequestStatus;
import com.example.messaging.security.VideoMediaTokenService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private final SocialPostReactionRepository reactionRepository;
    private final SocialPostCommentRepository commentRepository;
    private final UserService userService;
    private final FriendRequestRepository friendRequestRepository;
    private final VideoMediaTokenService videoMediaTokenService;
    private final SavedItemRepository savedItemRepository;

    @Transactional(readOnly = true)
    public List<FeedPostResponse> list(Long viewerId) {
        return postRepository.findAll().stream()
            .filter(post -> canView(post, viewerId))
                .sorted(java.util.Comparator.comparing(
                        SocialPost::getCreatedAt,
                        java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder())))
                .map(post -> toResponse(post, viewerId))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Page<FeedPostResponse> searchForExplore(String keyword, boolean videos, boolean popular,
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
        return postRepository.searchForExplore(query, videos, popular, savedOnly, followingOnly,
                viewerId, friendIds, PageRequest.of(safePage, safeSize))
                .map(post -> toResponse(post, viewerId));
    }

    @Transactional
    public FeedPostResponse create(Long authorId, CreatePostRequest request) {
        String content = request.getContent() == null ? null : request.getContent().trim();
        String imageUrl = request.getImageUrl() == null ? null : request.getImageUrl().trim();
        String mediaType = request.getMediaType() == null ? null : request.getMediaType().trim().toUpperCase();
        boolean hasContent = content != null && !content.isBlank();
        boolean hasMedia = imageUrl != null && !imageUrl.isBlank();

        if (!hasContent && !hasMedia) {
            throw ApiException.badRequest("Bài viết cần có nội dung hoặc ảnh/video");
        }
        if (hasMedia && mediaType != null && !"IMAGE".equals(mediaType) && !"VIDEO".equals(mediaType)) {
            throw ApiException.badRequest("Loại media không hợp lệ");
        }
        if (!hasMedia && mediaType != null) {
            throw ApiException.badRequest("Thiếu ảnh hoặc video cho bài viết");
        }

        User author = userService.getByIdOrThrow(authorId);
        String privacy = normalizePrivacy(request.getPrivacy());
        SocialPost post = postRepository.save(SocialPost.builder()
                .author(author)
                .content(hasContent ? content : "")
                .imageUrl(hasMedia ? imageUrl : null)
                .mediaType(hasMedia ? (mediaType == null ? resolveMediaType(imageUrl) : mediaType) : null)
                .privacy(privacy)
                .build());
        return toResponse(post, authorId);
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

        reactionRepository.findByPostPostIdAndUserUserId(postId, userId).ifPresentOrElse(reaction -> {
            String currentType = reaction.getReactionType() == null ? "LIKE" : reaction.getReactionType();
            if (currentType.equals(normalizedType)) {
                reactionRepository.delete(reaction);
            } else {
                reaction.setReactionType(normalizedType);
                reactionRepository.save(reaction);
            }
        }, () -> reactionRepository.save(SocialPostReaction.builder()
                .post(post)
                .user(user)
                .reactionType(normalizedType)
                .build()));
        return toResponse(post, userId);
    }

    @Transactional
    public FeedPostResponse addComment(Long postId, Long authorId, CreateCommentRequest request) {
        SocialPost post = getReadablePost(postId, authorId);
        User author = userService.getByIdOrThrow(authorId);
        SocialPostComment parentComment = request.getParentCommentId() == null ? null :
            commentRepository.findByCommentIdAndPostPostId(request.getParentCommentId(), postId)
                .orElseThrow(() -> ApiException.badRequest("Bình luận trả lời không thuộc bài viết này"));
        commentRepository.save(SocialPostComment.builder()
                .post(post)
                .author(author)
            .parentComment(parentComment)
                .content(request.getContent().trim())
                .build());
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
                .privacy(post.getPrivacy() == null ? "PUBLIC" : post.getPrivacy())
                .viewCount(post.getViewCount())
                .createdAt(post.getCreatedAt())
                .likeCount(reactionRepository.countByPostPostId(post.getPostId()))
                .likedByViewer(viewerReaction != null)
                .viewerReaction(viewerReaction == null ? null :
                    (viewerReaction.getReactionType() == null ? "LIKE" : viewerReaction.getReactionType()))
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
                .createdAt(post.getCreatedAt())
                .build();
    }

    private String playbackUrl(SocialPost post, Long viewerId) {
        String mediaType = post.getMediaType() == null ? resolveMediaType(post.getImageUrl()) : post.getMediaType();
        if (!"VIDEO".equals(mediaType) || post.getImageUrl() == null) return post.getImageUrl();
        return "/api/videos/" + post.getPostId() + "/media?token=" + videoMediaTokenService.issue(post.getPostId(), viewerId);
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
