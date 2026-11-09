package com.example.messaging.service;

import com.example.messaging.dto.feed.CreateStoryRequest;
import com.example.messaging.dto.feed.StoryResponse;
import com.example.messaging.entity.SocialStory;
import com.example.messaging.entity.User;
import com.example.messaging.exception.ApiException;
import com.example.messaging.repository.SocialStoryCommentRepository;
import com.example.messaging.repository.SocialStoryReactionRepository;
import com.example.messaging.repository.SocialStoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class StoryService {

    private final SocialStoryRepository storyRepository;
    private final SocialStoryReactionRepository reactionRepository;
    private final SocialStoryCommentRepository commentRepository;
    private final UserService userService;

    @Transactional(readOnly = true)
    public List<StoryResponse> list() {
        return storyRepository.findByExpiresAtAfterOrderByCreatedAtDesc(LocalDateTime.now())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public StoryResponse create(Long authorId, CreateStoryRequest request) {
        String content = request.getContent() == null ? null : request.getContent().trim();
        String mediaUrl = request.getMediaUrl() == null ? null : request.getMediaUrl().trim();
        String mediaType = request.getMediaType() == null ? null : request.getMediaType().trim().toUpperCase();

        boolean hasContent = content != null && !content.isBlank();
        boolean hasMedia = mediaUrl != null && !mediaUrl.isBlank();
        if (!hasContent && !hasMedia) {
            throw ApiException.badRequest("Tin cần có nội dung hoặc ảnh/video");
        }
        if (hasMedia && !"IMAGE".equals(mediaType) && !"VIDEO".equals(mediaType)) {
            throw ApiException.badRequest("Loại tin không hợp lệ");
        }
        if (!hasMedia && mediaType != null) {
            throw ApiException.badRequest("Thiếu ảnh hoặc video cho tin này");
        }

        LocalDateTime now = LocalDateTime.now();
        SocialStory story = storyRepository.save(SocialStory.builder()
                .author(userService.getByIdOrThrow(authorId))
                .content(hasContent ? content : null)
                .mediaUrl(hasMedia ? mediaUrl : null)
                .mediaType(hasMedia ? mediaType : null)
                .expiresAt(now.plusHours(24))
                .build());
        return toResponse(story);
    }

    @Transactional
    public void delete(Long requesterId, Long storyId) {
        SocialStory story = storyRepository.findById(storyId)
                .orElseThrow(() -> ApiException.notFound("KhÃ´ng tÃ¬m tháº¥y tin"));
        if (!story.getAuthor().getUserId().equals(requesterId)) {
            throw ApiException.forbidden("Chá»‰ ngÆ°á»i Ä‘Äƒng tin má»›i cÃ³ thá»ƒ xÃ³a tin");
        }
        // Xóa cảm xúc/bình luận của tin trước để không vướng khóa ngoại
        reactionRepository.deleteByStory_StoryId(storyId);
        commentRepository.deleteByStory_StoryId(storyId);
        storyRepository.delete(story);
    }

    private StoryResponse toResponse(SocialStory story) {
        User author = story.getAuthor();
        String authorName = author.getDisplayName() == null || author.getDisplayName().isBlank()
                ? author.getUsername() : author.getDisplayName();
        return StoryResponse.builder()
                .storyId(story.getStoryId())
                .authorId(author.getUserId())
                .authorName(authorName)
                .authorAvatar(author.getAvatar())
                .content(story.getContent())
                .mediaUrl(story.getMediaUrl())
                .mediaType(story.getMediaType())
                .createdAt(story.getCreatedAt())
                .expiresAt(story.getExpiresAt())
                .build();
    }
}
