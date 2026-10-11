package com.example.messaging.service;

import com.example.messaging.dto.chat.AttachmentResponse;
import com.example.messaging.dto.chat.MessageRequest;
import com.example.messaging.dto.chat.MessageReactionRequest;
import com.example.messaging.dto.chat.MessageReactionResponse;
import com.example.messaging.dto.chat.MessageReactionUpdate;
import com.example.messaging.dto.chat.MessageResponse;
import com.example.messaging.entity.*;
import com.example.messaging.entity.enums.MessageDeliveryStatus;
import com.example.messaging.entity.enums.MessageType;
import com.example.messaging.exception.ApiException;
import com.example.messaging.repository.*;
import com.example.messaging.entity.enums.FriendRequestStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Core chat 1-1 messaging logic (plan section 3 "Chat 1-1 - ưu tiên cao nhất"
 * and section 7 "Kiến trúc nghiệp vụ chính", steps 3-5):
 *   - send message -> persist -> broadcast realtime
 *   - Sent / Seen status
 *   - Reply, thu hồi (recall/unsend)
 *   - history with lazy loading, 20 messages per page
 */
@Service
@RequiredArgsConstructor
public class MessageService {

    private static final int PAGE_SIZE = 20;

    private final MessageRepository messageRepository;
    private final MessageStatusRepository messageStatusRepository;
    private final MessageReactionRepository messageReactionRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final ConversationMemberRepository conversationMemberRepository;
    private final ConversationService conversationService;
    private final UserService userService;

    @Transactional
    public MessageResponse sendMessage(Long senderId, MessageRequest request) {
        conversationService.assertMember(request.getConversationId(), senderId);

        User sender = userService.getByIdOrThrow(senderId);
        Conversation conversation = conversationService.getByIdOrThrow(request.getConversationId());
        List<ConversationMember> members = conversationMemberRepository
                .findByConversationConversationId(conversation.getConversationId());

        if (conversation.getType() == com.example.messaging.entity.enums.ConversationType.PRIVATE
                && !conversation.isMessageRequestAccepted()) {
            Long otherUserId = members.stream()
                    .map(member -> member.getUser().getUserId())
                    .filter(id -> !id.equals(senderId))
                    .findFirst()
                    .orElse(null);
            boolean friends = otherUserId != null && friendRequestRepository.findRelationship(senderId, otherUserId)
                    .stream().anyMatch(friend -> friend.getStatus() == FriendRequestStatus.ACCEPTED);

            if (friends) {
                conversation.setMessageRequestAccepted(true);
                members.forEach(member -> member.setMessageRequestPending(false));
                conversationMemberRepository.saveAll(members);
            } else if (conversation.getMessageRequestSenderId() == null) {
                conversation.setMessageRequestSenderId(senderId);
                members.stream()
                        .filter(member -> !member.getUser().getUserId().equals(senderId))
                        .findFirst()
                        .ifPresent(recipient -> {
                            recipient.setMessageRequestPending(true);
                            conversationMemberRepository.save(recipient);
                        });
            } else if (!conversation.getMessageRequestSenderId().equals(senderId)) {
                conversation.setMessageRequestAccepted(true);
                members.forEach(member -> member.setMessageRequestPending(false));
                conversationMemberRepository.saveAll(members);
            }
        }

        Message replyTo = null;
        if (request.getReplyToMessageId() != null) {
            replyTo = messageRepository.findById(request.getReplyToMessageId())
                    .orElseThrow(() -> ApiException.notFound("Không tìm thấy tin nhắn được reply"));
        }

        MessageType type = MessageType.TEXT;
        if (request.getMessageType() != null) {
            try {
                type = MessageType.valueOf(request.getMessageType());
            } catch (IllegalArgumentException ignored) { }
        }

        Message message = Message.builder()
                .conversation(conversation)
                .sender(sender)
                .content(request.getContent())
                .messageType(type)
                .replyToMessage(replyTo)
                .deleted(false)
                .build();

        message = messageRepository.save(message);

        // Create a MESSAGE_STATUS row for every other member of the conversation (Sent by default)
        for (ConversationMember member : members) {
            if (member.getUser().getUserId().equals(senderId)) continue;
            messageStatusRepository.save(MessageStatus.builder()
                    .message(message)
                    .user(member.getUser())
                    .status(MessageDeliveryStatus.SENT)
                    .build());
        }

        return toResponse(message, senderId);
    }

    @Transactional
    public MessageReactionUpdate toggleReaction(Long userId, MessageReactionRequest request) {
        Message message = messageRepository.findById(request.getMessageId())
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy tin nhắn"));
        Long conversationId = message.getConversation().getConversationId();
        if (!conversationId.equals(request.getConversationId())) {
            throw ApiException.badRequest("Tin nhắn không thuộc cuộc trò chuyện này");
        }
        conversationService.assertMember(conversationId, userId);
        if (message.isDeleted() || message.getMessageType() == MessageType.SYSTEM) {
            throw ApiException.badRequest("Không thể thả cảm xúc cho tin nhắn này");
        }

        Optional<MessageReaction> existing = messageReactionRepository
                .findByMessageMessageIdAndUserUserId(message.getMessageId(), userId);
        String emoji = request.getEmoji() == null ? "" : request.getEmoji().trim();
        if (emoji.isEmpty() || existing.map(reaction -> reaction.getEmoji().equals(emoji)).orElse(false)) {
            existing.ifPresent(messageReactionRepository::delete);
        } else if (existing.isPresent()) {
            existing.get().setEmoji(emoji);
            messageReactionRepository.save(existing.get());
        } else {
            messageReactionRepository.save(MessageReaction.builder()
                    .message(message)
                    .user(userService.getByIdOrThrow(userId))
                    .emoji(emoji)
                    .build());
        }

        return MessageReactionUpdate.builder()
                .conversationId(conversationId)
                .messageId(message.getMessageId())
                .reactions(getReactionSummary(message.getMessageId()))
                .build();
    }

    private List<MessageReactionResponse> getReactionSummary(Long messageId) {
        Map<String, List<MessageReaction>> grouped = messageReactionRepository
                .findByMessageMessageIdOrderByCreatedAtAsc(messageId).stream()
                .collect(Collectors.groupingBy(MessageReaction::getEmoji, LinkedHashMap::new, Collectors.toList()));
        return grouped.entrySet().stream()
                .map(entry -> MessageReactionResponse.builder()
                        .emoji(entry.getKey())
                        .count(entry.getValue().size())
                        .userIds(entry.getValue().stream()
                                .map(reaction -> reaction.getUser().getUserId())
                                .collect(Collectors.toList()))
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional
    public MessageResponse createSystemMessage(Long conversationId, Long actorId, String content) {
        conversationService.assertMember(conversationId, actorId);
        Conversation conversation = conversationService.getByIdOrThrow(conversationId);
        User actor = userService.getByIdOrThrow(actorId);
        Message message = messageRepository.save(Message.builder()
                .conversation(conversation)
                .sender(actor)
                .content(content)
                .messageType(MessageType.SYSTEM)
                .deleted(false)
                .build());

        for (ConversationMember member : conversationMemberRepository
                .findByConversationConversationId(conversationId)) {
            if (!member.getUser().getUserId().equals(actorId)) {
                messageStatusRepository.save(MessageStatus.builder()
                        .message(message)
                        .user(member.getUser())
                        .status(MessageDeliveryStatus.SENT)
                        .build());
            }
        }

        return toResponse(message, actorId);
    }

    @Transactional
    public MessageResponse editMessage(Long messageId, Long requesterId, String content) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy tin nhắn"));

        if (!message.getSender().getUserId().equals(requesterId)) {
            throw ApiException.forbidden("Chỉ người gửi mới có thể chỉnh sửa tin nhắn này");
        }
        if (message.isDeleted() || message.getMessageType() == MessageType.SYSTEM) {
            throw ApiException.badRequest("Không thể chỉnh sửa tin nhắn này");
        }

        String nextContent = content == null ? "" : content.trim();
        if (nextContent.isEmpty()) {
            throw ApiException.badRequest("Nội dung tin nhắn không được để trống");
        }

        message.setContent(nextContent);
        messageRepository.save(message);
        return toResponse(message, requesterId);
    }

    @Transactional
    public MessageResponse recall(Long messageId, Long requesterId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy tin nhắn"));

        if (!message.getSender().getUserId().equals(requesterId)) {
            throw ApiException.forbidden("Chỉ người gửi mới có thể thu hồi tin nhắn");
        }

        message.setDeleted(true);
        message.setContent(null);
        messageRepository.save(message);

        return toResponse(message, requesterId);
    }

    /** Marks every unseen message in the conversation as SEEN for this user (plan step 5). */
    @Transactional
    public void markConversationSeen(Long conversationId, Long userId) {
        conversationService.assertMember(conversationId, userId);

        // Iterate messages in the conversation not authored by this user and flip their status rows to SEEN
        Page<Message> page = messageRepository.findByConversationConversationIdOrderByCreatedAtDesc(
                conversationId, PageRequest.of(0, 1000, Sort.unsorted()));

        for (Message m : page.getContent()) {
            if (m.getSender().getUserId().equals(userId)) continue;
            messageStatusRepository.findByMessageMessageIdAndUserUserId(m.getMessageId(), userId)
                    .ifPresent(status -> {
                        if (status.getStatus() != MessageDeliveryStatus.SEEN) {
                            status.setStatus(MessageDeliveryStatus.SEEN);
                            status.setSeenAt(LocalDateTime.now());
                            messageStatusRepository.save(status);
                        }
                    });
        }
    }

    /** History with lazy loading: page 0 = latest 20 messages, page 1 = next 20 older, etc. */
    public List<MessageResponse> getHistory(Long conversationId, Long requesterId, int page) {
        conversationService.assertMember(conversationId, requesterId);

        Page<Message> result = messageRepository.findByConversationConversationIdOrderByCreatedAtDesc(
                conversationId, PageRequest.of(page, PAGE_SIZE, Sort.unsorted()));

        List<MessageResponse> responses = result.getContent().stream()
                .map(m -> toResponse(m, requesterId))
                .collect(Collectors.toList());
        // reverse so the frontend receives oldest -> newest for the requested page, like a real chat window
        java.util.Collections.reverse(responses);
        return responses;
    }

    private MessageResponse toResponse(Message m, Long viewerId) {
        String deliveryStatus = "SENT";
        if (!m.getSender().getUserId().equals(viewerId)) {
            deliveryStatus = null; // not meaningful when viewer is the recipient, not the sender
        } else {
            // For the sender's view, report the "best" status among recipients (SEEN > SENT)
            List<MessageStatus> statuses = messageStatusRepository.findByMessageMessageId(m.getMessageId());
            boolean anySeen = statuses.stream().anyMatch(s -> s.getStatus() == MessageDeliveryStatus.SEEN);
            deliveryStatus = anySeen ? "SEEN" : "SENT";
        }

        List<AttachmentResponse> attachments = m.getAttachments() == null ? List.of() :
                m.getAttachments().stream().map(a -> AttachmentResponse.builder()
                        .attachmentId(a.getAttachmentId())
                        .fileName(a.getFileName())
                        .fileUrl(a.getFileUrl())
                        .fileType(a.getFileType())
                        .fileSize(a.getFileSize())
                        .build()).collect(Collectors.toList());

        String replyPreview = null;
        if (m.getReplyToMessage() != null && !m.getReplyToMessage().isDeleted()) {
            if (m.getReplyToMessage().getMessageType() == MessageType.IMAGE) {
                replyPreview = "hình ảnh";
            } else if (m.getReplyToMessage().getMessageType() == MessageType.FILE) {
                replyPreview = "tệp đính kèm";
            } else if (m.getReplyToMessage().getMessageType() == MessageType.AUDIO) {
                replyPreview = "tin nhắn thoại";
            } else {
                replyPreview = truncate(m.getReplyToMessage().getContent());
            }
        }

        return MessageResponse.builder()
                .messageId(m.getMessageId())
                .conversationId(m.getConversation().getConversationId())
                .senderId(m.getSender().getUserId())
                .senderUsername(m.getSender().getUsername())
                .senderDisplayName(m.getSender().getDisplayName())
                .senderAvatar(m.getSender().getAvatar())
                .content(m.isDeleted() ? null : m.getContent())
                .messageType(m.getMessageType().name())
                .replyToMessageId(m.getReplyToMessage() != null ? m.getReplyToMessage().getMessageId() : null)
                .replyToContentPreview(replyPreview)
                .deleted(m.isDeleted())
                .deliveryStatus(deliveryStatus)
                .attachments(attachments)
                .reactions(getReactionSummary(m.getMessageId()))
                .createdAt(m.getCreatedAt())
                .build();
    }

    private String truncate(String content) {
        if (content == null) return null;
        return content.length() > 80 ? content.substring(0, 80) + "..." : content;
    }
}
