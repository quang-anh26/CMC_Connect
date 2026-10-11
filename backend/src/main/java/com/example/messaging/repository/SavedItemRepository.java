package com.example.messaging.repository;

import com.example.messaging.entity.SavedItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface SavedItemRepository extends JpaRepository<SavedItem, Long> {
    Optional<SavedItem> findByUserUserIdAndContentTypeAndContentId(Long userId, String contentType, Long contentId);
    boolean existsByUserUserIdAndContentTypeAndContentId(Long userId, String contentType, Long contentId);
    void deleteByUserUserIdAndContentTypeAndContentId(Long userId, String contentType, Long contentId);
    void deleteByContentTypeAndContentId(String contentType, Long contentId);

    @Query("SELECT s FROM SavedItem s WHERE s.user.userId = :userId " +
            "AND (:type = '' OR s.contentType = :type OR (:type = 'POST' AND s.contentType = 'GROUP_POST')) " +
            "AND (:collectionId IS NULL OR EXISTS (SELECT ci.id FROM CollectionItem ci WHERE ci.savedItem.savedItemId = s.savedItemId AND ci.collection.collectionId = :collectionId)) " +
            "AND (:keyword = '' OR " +
            "(s.contentType IN ('POST', 'VIDEO', 'LINK') AND EXISTS (SELECT p.postId FROM SocialPost p WHERE p.postId = s.contentId AND " +
            "(LOWER(p.content) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(p.author.username) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(COALESCE(p.author.displayName, '')) LIKE LOWER(CONCAT('%', :keyword, '%'))))) OR " +
            "(s.contentType = 'GROUP_POST' AND EXISTS (SELECT gp.postId FROM GroupPost gp WHERE gp.postId = s.contentId AND " +
            "(LOWER(gp.content) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(gp.group.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(gp.author.username) LIKE LOWER(CONCAT('%', :keyword, '%'))))) OR " +
            "(s.contentType = 'MARKETPLACE' AND EXISTS (SELECT l.listingId FROM MarketplaceListing l WHERE l.listingId = s.contentId AND " +
            "(LOWER(l.title) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(l.description) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(l.seller.username) LIKE LOWER(CONCAT('%', :keyword, '%'))))))")
    Page<SavedItem> search(@Param("userId") Long userId,
                           @Param("type") String type,
                           @Param("collectionId") Long collectionId,
                           @Param("keyword") String keyword,
                           Pageable pageable);
}
