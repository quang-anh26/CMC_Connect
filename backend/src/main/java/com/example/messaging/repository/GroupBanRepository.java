package com.example.messaging.repository;

import com.example.messaging.entity.GroupBan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GroupBanRepository extends JpaRepository<GroupBan, Long> {
    Optional<GroupBan> findByGroupGroupIdAndUserUserId(Long groupId, Long userId);
    void deleteByGroupGroupIdAndUserUserId(Long groupId, Long userId);
}