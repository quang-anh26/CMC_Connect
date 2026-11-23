package com.example.messaging.repository;

import com.example.messaging.entity.GroupCommentReaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface GroupCommentReactionRepository extends JpaRepository<GroupCommentReaction, Long> {
    Optional<GroupCommentReaction> findByCommentCommentIdAndUserUserId(Long commentId, Long userId);
    long countByCommentCommentId(Long commentId);
    boolean existsByCommentCommentIdAndUserUserId(Long commentId, Long userId);

    @Modifying
    @Query("DELETE FROM GroupCommentReaction r WHERE r.comment.commentId = :commentId")
    void deleteAllByCommentId(@Param("commentId") Long commentId);
}
