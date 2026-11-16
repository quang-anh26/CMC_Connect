package com.example.messaging.repository;

import com.example.messaging.entity.AppNotification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface AppNotificationRepository extends JpaRepository<AppNotification, Long> {
    List<AppNotification> findTop100ByRecipientUserIdAndTypeInOrderByCreatedAtDesc(Long recipientId, Set<String> types);
    Optional<AppNotification> findByIdAndRecipientUserId(Long id, Long recipientId);
    Optional<AppNotification> findTop1ByRecipientUserIdAndActorUserIdAndTypeAndReferenceTypeAndReferenceIdOrderByCreatedAtDesc(
        Long recipientId, Long actorId, String type, String referenceType, Long referenceId);
    long countByRecipientUserIdAndReadFalseAndTypeIn(Long recipientId, Set<String> types);
    List<AppNotification> findByRecipientUserIdAndReadFalseAndTypeIn(Long recipientId, Set<String> types);
}
