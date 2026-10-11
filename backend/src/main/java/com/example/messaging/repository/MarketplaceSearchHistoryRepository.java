package com.example.messaging.repository;

import com.example.messaging.entity.MarketplaceSearchHistory;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MarketplaceSearchHistoryRepository extends JpaRepository<MarketplaceSearchHistory, Long> {
    List<MarketplaceSearchHistory> findByUserUserIdOrderBySearchedAtDesc(Long userId, Pageable pageable);
}
