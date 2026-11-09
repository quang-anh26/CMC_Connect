package com.example.messaging.service;

import com.example.messaging.dto.feed.StoryCommentResponse;
import com.example.messaging.dto.feed.StoryInteractionResponse;
import com.example.messaging.entity.SocialStory;
import com.example.messaging.entity.SocialStoryComment;
import com.example.messaging.entity.SocialStoryReaction;
import com.example.messaging.entity.User;
import com.example.messaging.exception.ApiException;
import com.example.messaging.repository.SocialStoryCommentRepository;
import com.example.messaging.repository.SocialStoryReactionRepository;
import com.example.messaging.repository.SocialStoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Cảm xúc và bình luận cho tin của bạn bè. */
@Service
@RequiredArgsConstructor
public class StoryInteractionService {

    private static final Set<String> REACTION_TYPES = Set.of("LIKE", "LOVE", "HAHA", "WOW", "SAD", "ANGRY");
    private static final int MAX_COMMENT_LENGTH = 1000;

    private final SocialStoryRepository storyRepository;
    private final SocialStoryReactionRepository reactionRepository;
    private final SocialStoryCommentRepository commentRepository;
    private final UserService userService;

    @Transactional(readOnly = true)
    public StoryInteractionResponse get(Long viewerId, Long storyId) {
        SocialStory story = requireActiveStory(storyId);
        return build(story, viewerId);
    }

    /** Chọn cảm xúc; bấm lại đúng cảm xúc đang chọn thì bỏ cảm xúc. */
    @Transactional
    public StoryInteractionResponse react(Long viewerId, Long storyId, String reactionType) {
        String type = reactionType == null ? "" : reactionType.trim().toUpperCase();
        if (!REACTION_TYPES.contains(type)) {
            throw ApiException.badRequest("Loại cảm xúc không hợp lệ");
        }
        SocialStory story = requireActiveStory(storyId);
        var existing = reactionRepository.findByStory_StoryIdAndUser_UserId(storyId, viewerId);
        if (existing.isPresent()) {
            SocialStoryReaction reaction = existing.get();
            if (type.equals(reaction.getReactionType())) {
                reactionRepository.delete(reaction);
            } else {
                reaction.setReactionType(type);
                reactionRepository.save(reaction);
            }
        } else {
            reactionRepository.save(SocialStoryReaction.builder()
                    .story(story)
                    .user(userService.getByIdOrThrow(viewerId))
                    .reactionType(type)
                    .build());
        }
        reactionRepository.flush();
        return build(story, viewerId);
    }

    @Transactional
    public StoryInteractionResponse comment(Long viewerId, Long storyId, String content) {
        String text = content == null ? "" : content.trim();
        if (text.isEmpty()) {
            throw ApiException.badRequest("Bình luận không được để trống");
        }
        if (text.length() > MAX_COMMENT_LENGTH) {
            throw ApiException.badRequest("Bình luận quá dài");
        }
        SocialStory story = requireActiveStory(storyId);
        commentRepository.save(SocialStoryComment.builder()
                .story(story)
                .author(userService.getByIdOrThrow(viewerId))
                .content(text)
                .build());
        commentRepository.flush();
        return build(story, viewerId);
    }

    /** Người viết bình luận hoặc chủ của tin được xóa bình luận. */
    @Transactional
    public StoryInteractionResponse deleteComment(Long viewerId, Long storyId, Long commentId) {
        SocialStory story = requireActiveStory(storyId);
        SocialStoryComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy bình luận"));
        if (!comment.getStory().getStoryId().equals(storyId)) {
            throw ApiException.notFound("Không tìm thấy bình luận");
        }
        boolean isCommenter = comment.getAuthor().getUserId().equals(viewerId);
        boolean isStoryOwner = story.getAuthor().getUserId().equals(viewerId);
        if (!isCommenter && !isStoryOwner) {
            throw ApiException.forbidden("Bạn không thể xóa bình luận này");
        }
        commentRepository.delete(comment);
        commentRepository.flush();
        return build(story, viewerId);
    }

    private SocialStory requireActiveStory(Long storyId) {
        SocialStory story = storyRepository.findById(storyId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy tin"));
        if (story.getExpiresAt() != null && story.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw ApiException.notFound("Tin đã hết hạn");
        }
        return story;
    }

    private StoryInteractionResponse build(SocialStory story, Long viewerId) {
        Long storyId = story.getStoryId();
        List<SocialStoryReaction> reactions = reactionRepository.findByStory_StoryId(storyId);
        Map<String, Long> counts = new LinkedHashMap<>();
        String viewerReaction = null;
        for (SocialStoryReaction reaction : reactions) {
            counts.merge(reaction.getReactionType(), 1L, Long::sum);
            if (reaction.getUser().getUserId().equals(viewerId)) {
                viewerReaction = reaction.getReactionType();
            }
        }
        List<StoryCommentResponse> comments = commentRepository.findByStory_StoryIdOrderByCreatedAtAsc(storyId)
                .stream()
                .map(this::toCommentResponse)
                .toList();
        return StoryInteractionResponse.builder()
                .storyId(storyId)
                .reactionCount(reactions.size())
                .reactionCounts(counts)
                .viewerReaction(viewerReaction)
                .comments(comments)
                .build();
    }

    private StoryCommentResponse toCommentResponse(SocialStoryComment comment) {
        User author = comment.getAuthor();
        String name = author.getDisplayName() == null || author.getDisplayName().isBlank()
                ? author.getUsername() : author.getDisplayName();
        return StoryCommentResponse.builder()
                .commentId(comment.getCommentId())
                .authorId(author.getUserId())
                .authorName(name)
                .authorAvatar(author.getAvatar())
                .content(comment.getContent())
                .createdAt(comment.getCreatedAt())
                .build();
    }
}
