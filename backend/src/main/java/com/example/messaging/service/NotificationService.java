package com.example.messaging.service;

import com.example.messaging.dto.notification.NotificationResponse;
import com.example.messaging.entity.AppNotification;
import com.example.messaging.entity.User;
import com.example.messaging.exception.ApiException;
import com.example.messaging.repository.AppNotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.HashMap;
import java.util.List;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class NotificationService {
    private static final Set<String> NOTIFICATION_TYPES = Set.of(
        "POST_CREATED", "POST_REACTION", "EVENT_CREATED", "STORY_CREATED",
        "EVENT_UPDATED", "EVENT_CANCELLED", "EVENT_ATTENDANCE", "EVENT_REMINDER", "EVENT_STARTED");

    private final AppNotificationRepository repository;
    private final UserService userService;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public void create(Long recipientId, Long actorId, String type, String referenceType, Long referenceId, String message) {
        if (recipientId == null || actorId == null || type == null || recipientId.equals(actorId)
                || !NOTIFICATION_TYPES.contains(type)) return;
        if ("POST_REACTION".equals(type)) {
            LocalDateTime recentCutoff = LocalDateTime.now().minusMinutes(5);
            boolean recentlyNotified = repository
                .findTop1ByRecipientUserIdAndActorUserIdAndTypeAndReferenceTypeAndReferenceIdOrderByCreatedAtDesc(
                    recipientId, actorId, type, referenceType, referenceId)
                .map(existing -> existing.getCreatedAt() != null && existing.getCreatedAt().isAfter(recentCutoff))
                .orElse(false);
            if (recentlyNotified) return;
        }
        User recipient = userService.getByIdOrThrow(recipientId);
        User actor = userService.getByIdOrThrow(actorId);
        repository.save(AppNotification.builder()
            .recipient(recipient).actor(actor).type(type)
            .referenceType(referenceType).referenceId(referenceId).message(message).read(false).build());
        pushRealtime(recipient, type, referenceType, referenceId, message);
    }

    /**
     * Thông báo do hệ thống tạo (không có người thực hiện), ví dụ nhắc lịch sự kiện.
     * Mỗi (người nhận, loại, đối tượng) chỉ được tạo một lần.
     */
    @Transactional
    public void createSystem(Long recipientId, String type, String referenceType, Long referenceId, String message) {
        if (recipientId == null || type == null || !NOTIFICATION_TYPES.contains(type)) return;
        if (repository.existsByRecipientUserIdAndTypeAndReferenceTypeAndReferenceId(
                recipientId, type, referenceType, referenceId)) return;
        User recipient = userService.getByIdOrThrow(recipientId);
        repository.save(AppNotification.builder()
            .recipient(recipient).type(type)
            .referenceType(referenceType).referenceId(referenceId).message(message).read(false).build());
        pushRealtime(recipient, type, referenceType, referenceId, message);
    }

    /** Đẩy thông báo tới trình duyệt qua WebSocket (sau khi giao dịch đã commit). */
    private void pushRealtime(User recipient, String type, String referenceType, Long referenceId, String message) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", type);
        payload.put("referenceType", referenceType);
        payload.put("referenceId", referenceId);
        payload.put("message", message);
        Runnable send = () -> {
            try {
                messagingTemplate.convertAndSendToUser(recipient.getUsername(), "/queue/notifications", payload);
            } catch (Exception ignored) {
                // thông báo vẫn nằm trong DB, client sẽ thấy khi tải lại
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    send.run();
                }
            });
        } else {
            send.run();
        }
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> list(Long userId) {
        return repository.findTop100ByRecipientUserIdAndTypeInOrderByCreatedAtDesc(userId, NOTIFICATION_TYPES)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public long unreadCount(Long userId) {
        return repository.countByRecipientUserIdAndReadFalseAndTypeIn(userId, NOTIFICATION_TYPES);
    }

    @Transactional
    public void markRead(Long notificationId, Long userId) {
        AppNotification item = repository.findByIdAndRecipientUserId(notificationId, userId)
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy thông báo"));
        item.setRead(true);
    }

    @Transactional
    public void markAllRead(Long userId) {
        repository.findByRecipientUserIdAndReadFalseAndTypeIn(userId, NOTIFICATION_TYPES)
                .forEach(item -> item.setRead(true));
    }

    @Transactional
    public void delete(Long notificationId, Long userId) {
        AppNotification item = repository.findByIdAndRecipientUserId(notificationId, userId)
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy thông báo"));
        repository.delete(item);
    }

    private NotificationResponse toResponse(AppNotification item) {
        User actor = item.getActor();
        return new NotificationResponse(item.getId(), item.getType(), item.getReferenceType(), item.getReferenceId(),
            item.getMessage(), item.isRead(), item.getCreatedAt(), actor == null ? null : actor.getUserId(),
            actor == null ? null : actor.getUsername(), actor == null ? null : actor.getDisplayName(),
            actor == null ? null : actor.getAvatar());
    }
}
