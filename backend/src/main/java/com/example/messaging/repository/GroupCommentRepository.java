package com.example.messaging.repository;

import com.example.messaging.entity.GroupComment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.time.LocalDateTime;

public interface GroupCommentRepository extends JpaRepository<GroupComment, Long> {
    List<GroupComment> findByPostPostIdOrderByCreatedAtAsc(Long postId);
    List<GroupComment> findByParentCommentCommentId(Long parentCommentId);
    long countByPostGroupGroupIdAndAuthorUserIdAndCreatedAtAfter(Long groupId, Long authorId, LocalDateTime after);
}