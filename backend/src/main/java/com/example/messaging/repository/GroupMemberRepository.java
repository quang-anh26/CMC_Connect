package com.example.messaging.repository;

import com.example.messaging.entity.GroupMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GroupMemberRepository extends JpaRepository<GroupMember, Long> {
    Optional<GroupMember> findByGroupGroupIdAndUserUserId(Long groupId, Long userId);
    boolean existsByGroupGroupIdAndUserUserId(Long groupId, Long userId);
    List<GroupMember> findByGroupGroupIdOrderByJoinedAtAsc(Long groupId);
    List<GroupMember> findByUserUserIdOrderByJoinedAtDesc(Long userId);
    long countByGroupGroupId(Long groupId);
    void deleteByGroupGroupIdAndUserUserId(Long groupId, Long userId);
}