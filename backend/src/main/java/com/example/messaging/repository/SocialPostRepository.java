package com.example.messaging.repository;

import com.example.messaging.entity.SocialPost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SocialPostRepository extends JpaRepository<SocialPost, Long> {
    long countBySharedPostPostId(Long postId);
    java.util.List<SocialPost> findBySharedPostPostId(Long postId);

    @Query(value = "SELECT p FROM SocialPost p WHERE " +
            "(:keyword = '' OR LOWER(p.content) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
            "LOWER(COALESCE(p.author.displayName, '')) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
            "LOWER(p.author.username) LIKE LOWER(CONCAT('%', :keyword, '%'))) AND " +
            "(p.author.userId = :viewerId OR p.privacy = 'PUBLIC' OR " +
            "(p.privacy = 'FRIENDS' AND p.author.userId IN :friendIds)) AND " +
            "(:videos = false OR p.mediaType = 'VIDEO') AND " +
            "(:savedOnly = false OR EXISTS (SELECT s.savedItemId FROM SavedItem s WHERE s.contentType = 'VIDEO' AND s.contentId = p.postId AND s.user.userId = :viewerId)) AND " +
            "(:followingOnly = false OR EXISTS (SELECT f.id FROM VideoFollow f WHERE f.creator.userId = p.author.userId AND f.follower.userId = :viewerId)) " +
            "ORDER BY CASE WHEN :popular = true THEN SIZE(p.reactions) ELSE 0 END DESC, p.viewCount DESC, p.createdAt DESC",
            countQuery = "SELECT COUNT(p) FROM SocialPost p WHERE " +
                    "(:keyword = '' OR LOWER(p.content) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
                    "LOWER(COALESCE(p.author.displayName, '')) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
                    "LOWER(p.author.username) LIKE LOWER(CONCAT('%', :keyword, '%'))) AND " +
                    "(p.author.userId = :viewerId OR p.privacy = 'PUBLIC' OR " +
                    "(p.privacy = 'FRIENDS' AND p.author.userId IN :friendIds)) AND " +
                    "(:videos = false OR p.mediaType = 'VIDEO') AND " +
                    "(:savedOnly = false OR EXISTS (SELECT s.savedItemId FROM SavedItem s WHERE s.contentType = 'VIDEO' AND s.contentId = p.postId AND s.user.userId = :viewerId)) AND " +
                    "(:followingOnly = false OR EXISTS (SELECT f.id FROM VideoFollow f WHERE f.creator.userId = p.author.userId AND f.follower.userId = :viewerId)) AND " +
                    "(:popular = true OR :popular = false)")
    Page<SocialPost> searchForExplore(@Param("keyword") String keyword,
                                      @Param("videos") boolean videos,
                                      @Param("popular") boolean popular,
                                      @Param("savedOnly") boolean savedOnly,
                                      @Param("followingOnly") boolean followingOnly,
                                      @Param("viewerId") Long viewerId,
                                      @Param("friendIds") java.util.List<Long> friendIds,
                                      Pageable pageable);
}
