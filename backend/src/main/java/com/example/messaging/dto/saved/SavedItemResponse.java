package com.example.messaging.dto.saved;

import java.time.LocalDateTime;

public record SavedItemResponse(
        Long savedItemId,
        String contentType,
        Long contentId,
        String title,
        String description,
        String authorName,
        String authorAvatar,
        String previewUrl,
        String targetUrl,
        String sourcePath,
        LocalDateTime savedAt,
        Long collectionId,
        String collectionName) {}
