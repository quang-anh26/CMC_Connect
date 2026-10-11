package com.example.messaging.repository;

import com.example.messaging.entity.MarketplaceReport;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MarketplaceReportRepository extends JpaRepository<MarketplaceReport, Long> {
    boolean existsByReporterUserIdAndListingListingIdAndTargetType(Long reporterId, Long listingId, String targetType);
    boolean existsByReporterUserIdAndReportedSellerUserIdAndTargetType(Long reporterId, Long sellerId, String targetType);
    void deleteByListingListingId(Long listingId);
}
