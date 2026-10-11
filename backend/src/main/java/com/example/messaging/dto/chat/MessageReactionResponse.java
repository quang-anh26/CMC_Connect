package com.example.messaging.dto.chat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
public class MessageReactionResponse {
    private String emoji;
    private long count;
    private List<Long> userIds;
}
