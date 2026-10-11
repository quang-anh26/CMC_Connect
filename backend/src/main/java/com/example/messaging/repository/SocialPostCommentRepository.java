package com.example.messaging.repository;

import com.example.messaging.entity.SocialPostComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SocialPostCommentRepository extends JpaRepository<SocialPostComment, Long> {
    List<SocialPostComment> findByPostPostIdOrderByCreatedAtAsc(Long postId);
    Optional<SocialPostComment> findByCommentIdAndPostPostId(Long commentId, Long postId);

    @Modifying
    @Query("DELETE FROM SocialPostComment c WHERE c.post.postId = :postId")
    void deleteAllByPostId(@Param("postId") Long postId);
}
