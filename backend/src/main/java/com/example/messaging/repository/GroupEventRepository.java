package com.example.messaging.repository;

import com.example.messaging.entity.GroupEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GroupEventRepository extends JpaRepository<GroupEvent, Long> {
    List<GroupEvent> findByGroupGroupIdOrderByStartsAtAsc(Long groupId);
    Optional<GroupEvent> findByIdAndGroupGroupId(Long eventId, Long groupId);
}