package com.example.messaging.dto.chat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
public class MessageReactionUpdate {
    private Long conversationId;
    private Long messageId;
    private List<MessageReactionResponse> reactions;
}
