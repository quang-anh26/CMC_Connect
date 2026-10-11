package com.example.messaging.dto.chat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
public class MessageResponse {
    private Long messageId;
    private Long conversationId;
    private Long senderId;
    private String senderUsername;
    private String senderDisplayName;
    private String senderAvatar;
    private String content;
    private String messageType;
    private Long replyToMessageId;
    private String replyToContentPreview;
    private boolean deleted;
    private String deliveryStatus; // SENT / DELIVERED / SEEN (relative to the requester's conversation partner)
    private List<AttachmentResponse> attachments;
    private List<MessageReactionResponse> reactions;
    private LocalDateTime createdAt;
}
