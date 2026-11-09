package com.example.messaging.repository;

import com.example.messaging.entity.AppNotification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AppNotificationRepository extends JpaRepository<AppNotification, Long> {
    List<AppNotification> findTop100ByRecipientUserIdOrderByCreatedAtDesc(Long recipientId);
    Optional<AppNotification> findByIdAndRecipientUserId(Long id, Long recipientId);
    Optional<AppNotification> findTop1ByRecipientUserIdAndActorUserIdAndTypeAndReferenceTypeAndReferenceIdOrderByCreatedAtDesc(
        Long recipientId, Long actorId, String type, String referenceType, Long referenceId);
    long countByRecipientUserIdAndReadFalse(Long recipientId);
    List<AppNotification> findByRecipientUserIdAndReadFalse(Long recipientId);
}
