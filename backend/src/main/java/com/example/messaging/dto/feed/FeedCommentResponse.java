package com.example.messaging.dto.feed;

import lombok.Builder;
import lombok.Value;

import java.time.LocalDateTime;

@Value
@Builder
public class FeedCommentResponse {
    Long commentId;
    Long parentCommentId;
    Long authorId;
    String authorName;
    String authorAvatar;
    String content;
    LocalDateTime createdAt;
}
