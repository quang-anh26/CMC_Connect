package com.example.messaging.dto.chat;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class MessageReactionRequest {
    @NotNull
    @Positive
    private Long conversationId;

    @NotNull
    @Positive
    private Long messageId;

    @Size(max = 16)
    private String emoji;
}
