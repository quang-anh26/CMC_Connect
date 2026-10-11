package com.example.messaging.repository;

import com.example.messaging.entity.MarketplaceSaved;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.List;

public interface MarketplaceSavedRepository extends JpaRepository<MarketplaceSaved, Long> {
    Optional<MarketplaceSaved> findByListingListingIdAndUserUserId(Long listingId, Long userId);
    boolean existsByListingListingIdAndUserUserId(Long listingId, Long userId);
    List<MarketplaceSaved> findByUserUserIdOrderBySavedAtDesc(Long userId);
    void deleteByListingListingId(Long listingId);
}
