package com.example.messaging.dto.saved;

import java.time.LocalDateTime;

public record SavedCollectionResponse(Long collectionId, String name, LocalDateTime createdAt, long itemCount) {}
