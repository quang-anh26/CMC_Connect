package com.example.messaging.dto.feed;

import lombok.Builder;
import lombok.Value;

import java.time.LocalDateTime;
import java.util.List;

@Value
@Builder
public class SharedPostResponse {
    Long postId;
    Long authorId;
    String authorName;
    String authorAvatar;
    String content;
    String imageUrl;
    String mediaType;
    List<PostMediaItem> mediaItems;
    LocalDateTime createdAt;
}