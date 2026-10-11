package com.example.messaging.repository;

import com.example.messaging.entity.MarketplaceSellerFollow;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MarketplaceSellerFollowRepository extends JpaRepository<MarketplaceSellerFollow, Long> {
    Optional<MarketplaceSellerFollow> findBySellerUserIdAndFollowerUserId(Long sellerId, Long followerId);
    boolean existsBySellerUserIdAndFollowerUserId(Long sellerId, Long followerId);
    void deleteBySellerUserId(Long sellerId);
}
