package com.example.messaging.repository;

import com.example.messaging.entity.GroupJoinRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GroupJoinRequestRepository extends JpaRepository<GroupJoinRequest, Long> {
    Optional<GroupJoinRequest> findByGroupGroupIdAndUserUserId(Long groupId, Long userId);
    List<GroupJoinRequest> findByGroupGroupIdAndStatusOrderByCreatedAtDesc(Long groupId, String status);
}