package com.example.messaging.repository;

import com.example.messaging.entity.GroupNotification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GroupNotificationRepository extends JpaRepository<GroupNotification, Long> {
    List<GroupNotification> findTop100ByUserUserIdOrderByCreatedAtDesc(Long userId);
    Optional<GroupNotification> findByIdAndUserUserId(Long id, Long userId);
}