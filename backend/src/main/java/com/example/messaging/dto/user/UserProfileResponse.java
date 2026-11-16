package com.example.messaging.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.time.LocalDate;

@Data
@Builder
@AllArgsConstructor
public class UserProfileResponse {
    private Long userId;
    private String username;
    private String displayName;
    private String avatar;
    private String coverImage;
    private String bio;
    private String education;
    private String location;
    private String relationshipStatus;
    private LocalDate birthDate;
    private LocalDateTime createdAt;
    private boolean online;
    private String status; // ACTIVE / LOCKED
    private String friendshipStatus; // ACCEPTED / PENDING_SENT / PENDING_RECEIVED / null
    private Long friendRequestId;
}
