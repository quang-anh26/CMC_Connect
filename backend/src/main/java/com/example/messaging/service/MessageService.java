package com.example.messaging.service;

import com.example.messaging.dto.chat.AttachmentResponse;
import com.example.messaging.dto.chat.MessageReactionRequest;
import com.example.messaging.dto.chat.MessageReactionResponse;
import com.example.messaging.dto.chat.MessageReactionUpdate;
import com.example.messaging.dto.chat.MessageRequest;
import com.example.messaging.dto.chat.MessageResponse;
import com.example.messaging.entity.Conversation;
import com.example.messaging.entity.ConversationMember;
import com.example.messaging.entity.Message;
import com.example.messaging.entity.MessageReaction;
import com.example.messaging.entity.MessageStatus;
import com.example.messaging.entity.User;
import com.example.messaging.entity.enums.ConversationType;
import com.example.messaging.entity.enums.FriendRequestStatus;
import com.example.messaging.entity.enums.MessageDeliveryStatus;
import com.example.messaging.entity.enums.MessageType;
import com.example.messaging.exception.ApiException;
import com.example.messaging.repository.ConversationMemberRepository;
import com.example.messaging.repository.FriendRequestRepository;
import com.example.messaging.repository.MessageReactionRepository;
import com.example.messaging.repository.MessageRepository;
import com.example.messaging.repository.MessageStatusRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

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
        if (request == null) {
            throw ApiException.badRequest("Yêu cầu tin nhắn không hợp lệ");
        }
        if (request.getConversationId() == null) {
            throw ApiException.badRequest("conversationId là bắt buộc");
        }
        if (senderId == null) {
            throw ApiException.unauthorized("Người dùng chưa đăng nhập");
        }

        conversationService.assertMember(request.getConversationId(), senderId);

        User sender = userService.getByIdOrThrow(senderId);
        Conversation conversation = conversationService.getByIdOrThrow(request.getConversationId());
        List<ConversationMember> members = conversationMemberRepository
                .findByConversationConversationId(conversation.getConversationId());

        if (conversation.getType() == ConversationType.PRIVATE && !conversation.isMessageRequestAccepted()) {
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

        String normalizedMessageType = request.getMessageType() == null ? "TEXT" : request.getMessageType().trim().toUpperCase(Locale.ROOT);
        if ("TEXT".equals(normalizedMessageType) && (request.getContent() == null || request.getContent().isBlank())) {
            throw ApiException.badRequest("Nội dung tin nhắn không được để trống");
        }

        Message replyTo = null;
        if (request.getReplyToMessageId() != null) {
            replyTo = messageRepository.findById(request.getReplyToMessageId())
                    .orElseThrow(() -> ApiException.notFound("Không tìm thấy tin nhắn được reply"));
            if (!replyTo.getConversation().getConversationId().equals(request.getConversationId())) {
                throw ApiException.badRequest("Tin nhắn trả lời phải thuộc cùng cuộc trò chuyện");
            }
        }

        MessageType type = MessageType.TEXT;
        if (request.getMessageType() != null) {
            try {
                type = MessageType.valueOf(normalizedMessageType);
            } catch (IllegalArgumentException ignored) {
            }
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
        if (request == null || request.getMessageId() == null || request.getConversationId() == null) {
            throw ApiException.badRequest("Dữ liệu cảm xúc không hợp lệ");
        }

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

        String emoji = request.getEmoji() == null ? "" : request.getEmoji().trim();
        if (emoji.isEmpty()) {
            throw ApiException.badRequest("Emoji cảm xúc không hợp lệ");
        }

        Optional<MessageReaction> existing = messageReactionRepository
                .findByMessageMessageIdAndUserUserId(message.getMessageId(), userId);

        if (existing.isPresent() && existing.get().getEmoji().equals(emoji)) {
            messageReactionRepository.delete(existing.get());
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
        message.setEdited(true);
        message.setEditedAt(LocalDateTime.now());
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

    @Transactional
    public void markConversationSeen(Long conversationId, Long userId) {
        conversationService.assertMember(conversationId, userId);

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

    public List<MessageResponse> getHistory(Long conversationId, Long requesterId, int page) {
        if (page < 0) {
            throw ApiException.badRequest("page phải lớn hơn hoặc bằng 0");
        }

        conversationService.assertMember(conversationId, requesterId);

        Page<Message> result = messageRepository.findByConversationConversationIdOrderByCreatedAtDesc(
                conversationId, PageRequest.of(page, PAGE_SIZE, Sort.unsorted()));

        List<MessageResponse> responses = result.getContent().stream()
                .map(m -> toResponse(m, requesterId))
                .collect(Collectors.toList());
        java.util.Collections.reverse(responses);
        return responses;
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

    private MessageResponse toResponse(Message m, Long viewerId) {
        String deliveryStatus = "SENT";
        if (!m.getSender().getUserId().equals(viewerId)) {
            deliveryStatus = null;
        } else {
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
                .edited(m.isEdited())
                .editedAt(m.getEditedAt())
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
