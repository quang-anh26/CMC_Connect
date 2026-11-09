package com.example.messaging.dto.notification;

import java.time.LocalDateTime;

public record NotificationResponse(
    Long id,
    String type,
    String referenceType,
    Long referenceId,
    String message,
    boolean read,
    LocalDateTime createdAt,
    Long actorId,
    String actorUsername,
    String actorDisplayName,
    String actorAvatar
) {}
