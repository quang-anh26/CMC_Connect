package com.example.messaging.dto.marketplace;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record MarketplaceListingResponse(
        Long listingId,
        Long sellerId,
        String sellerName,
        String sellerUsername,
        String sellerAvatar,
        String title,
        String description,
        BigDecimal price,
        String category,
        String condition,
        String location,
        String status,
        long viewCount,
        long shareCount,
        boolean savedByViewer,
        boolean followingSeller,
        List<String> imageUrls,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {}
