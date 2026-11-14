package com.example.messaging.repository;

import com.example.messaging.entity.SocialPostCommentReaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface SocialPostCommentReactionRepository extends JpaRepository<SocialPostCommentReaction, Long> {
    Optional<SocialPostCommentReaction> findByCommentCommentIdAndUserUserId(Long commentId, Long userId);
    long countByCommentCommentId(Long commentId);
    @Modifying
    @Query("DELETE FROM SocialPostCommentReaction r WHERE r.comment.commentId = :commentId")
    void deleteAllByCommentId(@Param("commentId") Long commentId);
    @Modifying
    @Query("DELETE FROM SocialPostCommentReaction r WHERE r.comment.post.postId = :postId")
    void deleteAllByPostId(@Param("postId") Long postId);
}
