package com.example.messaging.service;

import com.example.messaging.dto.notification.NotificationResponse;
import com.example.messaging.entity.AppNotification;
import com.example.messaging.entity.User;
import com.example.messaging.exception.ApiException;
import com.example.messaging.repository.AppNotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class NotificationService {
    private final AppNotificationRepository repository;
    private final UserService userService;

    @Transactional
    public void create(Long recipientId, Long actorId, String type, String referenceType, Long referenceId, String message) {
        if (recipientId == null || actorId == null || recipientId.equals(actorId)) return;
        if ("POST_REACTION".equals(type) || "MESSAGE".equals(type)) {
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
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> list(Long userId) {
        return repository.findTop100ByRecipientUserIdOrderByCreatedAtDesc(userId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public long unreadCount(Long userId) { return repository.countByRecipientUserIdAndReadFalse(userId); }

    @Transactional
    public void markRead(Long notificationId, Long userId) {
        AppNotification item = repository.findByIdAndRecipientUserId(notificationId, userId)
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy thông báo"));
        item.setRead(true);
    }

    @Transactional
    public void markAllRead(Long userId) {
        repository.findByRecipientUserIdAndReadFalse(userId).forEach(item -> item.setRead(true));
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
