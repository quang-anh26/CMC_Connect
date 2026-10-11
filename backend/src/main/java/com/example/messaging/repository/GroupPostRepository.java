package com.example.messaging.repository;

import com.example.messaging.entity.GroupPost;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;

public interface GroupPostRepository extends JpaRepository<GroupPost, Long> {
    List<GroupPost> findByGroupGroupIdAndStatusOrderByPinnedDescCreatedAtDesc(Long groupId, String status);
    List<GroupPost> findByGroupGroupIdAndStatusAndContentContainingIgnoreCaseOrderByPinnedDescCreatedAtDesc(
            Long groupId, String status, String content);
    Optional<GroupPost> findByPostIdAndGroupGroupId(Long postId, Long groupId);
    long countByGroupGroupIdAndAuthorUserIdAndCreatedAtAfter(Long groupId, Long authorId, LocalDateTime after);
}