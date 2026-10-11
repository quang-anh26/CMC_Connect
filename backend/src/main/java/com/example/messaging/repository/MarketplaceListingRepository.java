package com.example.messaging.repository;

import com.example.messaging.entity.MarketplaceListing;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.Optional;

public interface MarketplaceListingRepository extends JpaRepository<MarketplaceListing, Long> {
    @Query("SELECT DISTINCT l FROM MarketplaceListing l WHERE " +
            "(:scope = 'MINE' AND l.seller.userId = :viewerId OR " +
            "(:scope = 'SAVED' AND EXISTS (SELECT s.savedItemId FROM SavedItem s WHERE s.contentType = 'MARKETPLACE' AND s.contentId = l.listingId AND s.user.userId = :viewerId)) OR " +
            "(:scope NOT IN ('MINE', 'SAVED') AND l.status = 'ACTIVE')) AND " +
            "(:scope = 'MINE' OR :status = '' OR l.status = :status) AND " +
            "(:scope <> 'SAVED' OR :status = '' OR l.status = :status) AND " +
            "(:keyword = '' OR LOWER(l.title) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
            "LOWER(l.description) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
            "LOWER(l.category) LIKE LOWER(CONCAT('%', :keyword, '%'))) AND " +
            "(:category = '' OR l.category = :category) AND " +
            "(:condition = '' OR l.condition = :condition) AND " +
            "(:minPrice IS NULL OR l.price >= :minPrice) AND " +
            "(:maxPrice IS NULL OR l.price <= :maxPrice) AND " +
            "(:location = '' OR LOWER(l.location) LIKE LOWER(CONCAT('%', :location, '%'))) AND " +
            "(:sellerId IS NULL OR l.seller.userId = :sellerId)")
    Page<MarketplaceListing> search(@Param("viewerId") Long viewerId,
                                    @Param("scope") String scope,
                                    @Param("status") String status,
                                    @Param("keyword") String keyword,
                                    @Param("category") String category,
                                    @Param("condition") String condition,
                                    @Param("minPrice") BigDecimal minPrice,
                                    @Param("maxPrice") BigDecimal maxPrice,
                                    @Param("location") String location,
                                    @Param("sellerId") Long sellerId,
                                    Pageable pageable);

    @Query("SELECT l FROM MarketplaceListing l WHERE l.listingId = :listingId AND " +
            "(l.status = 'ACTIVE' OR l.seller.userId = :viewerId OR " +
            "EXISTS (SELECT si.savedItemId FROM SavedItem si WHERE si.contentType = 'MARKETPLACE' AND si.contentId = l.listingId AND si.user.userId = :viewerId) OR " +
            "EXISTS (SELECT s.id FROM MarketplaceSaved s WHERE s.listing.listingId = l.listingId AND s.user.userId = :viewerId))")
    Optional<MarketplaceListing> findReadableById(@Param("listingId") Long listingId, @Param("viewerId") Long viewerId);

    Page<MarketplaceListing> findByStatus(String status, Pageable pageable);
}
