package com.example.messaging.dto.feed;

import lombok.Builder;
import lombok.Value;

import java.time.LocalDateTime;

@Value
@Builder
public class StoryCommentResponse {
    Long commentId;
    Long authorId;
    String authorName;
    String authorAvatar;
    String content;
    LocalDateTime createdAt;
}
