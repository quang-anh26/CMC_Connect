package com.example.messaging.repository;

import com.example.messaging.entity.GroupInvite;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GroupInviteRepository extends JpaRepository<GroupInvite, Long> {
    Optional<GroupInvite> findByGroupGroupIdAndInviteeUserId(Long groupId, Long userId);
    List<GroupInvite> findByInviteeUserIdAndStatusOrderByCreatedAtDesc(Long userId, String status);
}