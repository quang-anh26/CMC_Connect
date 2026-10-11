package com.example.messaging.repository;

import com.example.messaging.entity.GroupEventParticipant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GroupEventParticipantRepository extends JpaRepository<GroupEventParticipant, Long> {
    Optional<GroupEventParticipant> findByEventIdAndUserUserId(Long eventId, Long userId);
    long countByEventId(Long eventId);
    void deleteByEventId(Long eventId);
}