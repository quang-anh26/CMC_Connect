package com.example.messaging.dto.chat;

import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class UpdateConversationDetailsRequest {
    @Positive
    private Long targetUserId;

    @Size(max = 50)
    private String nickname;

    @Size(max = 255)
    private String topic;
}