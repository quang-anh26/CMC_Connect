package com.example.messaging.controller;

import com.example.messaging.dto.marketplace.MarketplaceListingResponse;
import com.example.messaging.dto.marketplace.MarketplaceReportRequest;
import com.example.messaging.dto.marketplace.MarketplaceUpsertRequest;
import com.example.messaging.security.CurrentUser;
import com.example.messaging.service.MarketplaceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/marketplace")
@RequiredArgsConstructor
public class MarketplaceController {
    private final MarketplaceService marketplaceService;

    @GetMapping
    public ResponseEntity<Page<MarketplaceListingResponse>> search(
            @CurrentUser Long userId,
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "") String category,
            @RequestParam(defaultValue = "") String condition,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(defaultValue = "") String location,
            @RequestParam(defaultValue = "NEWEST") String sort,
            @RequestParam(defaultValue = "ALL") String scope,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(required = false) Long sellerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size) {
        String searchLocation = location;
        if ("NEARBY".equalsIgnoreCase(sort) && searchLocation.isBlank()) {
            searchLocation = marketplaceService.sellerLocation(userId);
            if (searchLocation == null) searchLocation = "";
        }
        String order = "NEARBY".equalsIgnoreCase(sort) ? "NEWEST" : sort;
        return ResponseEntity.ok(marketplaceService.search(userId, q, category, condition, minPrice, maxPrice,
                searchLocation, order, scope, status, sellerId, page, size));
    }

    @GetMapping("/recommendations")
    public ResponseEntity<Page<MarketplaceListingResponse>> recommendations(
            @CurrentUser Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size) {
        List<String> recentSearches = marketplaceService.recentSearches(userId);
        String keyword = recentSearches.isEmpty() ? "" : recentSearches.get(0);
        return ResponseEntity.ok(marketplaceService.search(userId, keyword, "", "", null, null, "",
                "POPULAR", "ALL", "", null, page, size));
    }

    @GetMapping("/search-history")
    public ResponseEntity<List<String>> searchHistory(@CurrentUser Long userId) {
        return ResponseEntity.ok(marketplaceService.recentSearches(userId));
    }

    @PostMapping(value = "/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, List<String>>> uploadImages(
            @CurrentUser Long userId, @RequestParam(value = "files", required = false) List<MultipartFile> files) {
        return ResponseEntity.ok(Map.of("imageUrls", marketplaceService.uploadImages(userId, files)));
    }

    @GetMapping("/{listingId}")
    public ResponseEntity<MarketplaceListingResponse> get(@PathVariable Long listingId, @CurrentUser Long userId) {
        return ResponseEntity.ok(marketplaceService.view(listingId, userId));
    }

    @PostMapping
    public ResponseEntity<MarketplaceListingResponse> create(
            @CurrentUser Long userId, @Valid @RequestBody MarketplaceUpsertRequest request) {
        return ResponseEntity.ok(marketplaceService.create(userId, request));
    }

    @PutMapping("/{listingId}")
    public ResponseEntity<MarketplaceListingResponse> update(
            @PathVariable Long listingId, @CurrentUser Long userId,
            @Valid @RequestBody MarketplaceUpsertRequest request) {
        return ResponseEntity.ok(marketplaceService.update(listingId, userId, request));
    }

    @DeleteMapping("/{listingId}")
    public ResponseEntity<Void> delete(@PathVariable Long listingId, @CurrentUser Long userId) {
        marketplaceService.delete(listingId, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{listingId}/sold")
    public ResponseEntity<MarketplaceListingResponse> sold(@PathVariable Long listingId, @CurrentUser Long userId) {
        return ResponseEntity.ok(marketplaceService.markSold(listingId, userId));
    }

    @PostMapping("/{listingId}/save")
    public ResponseEntity<Map<String, Boolean>> save(@PathVariable Long listingId, @CurrentUser Long userId) {
        return ResponseEntity.ok(Map.of("saved", marketplaceService.toggleSaved(listingId, userId)));
    }

    @PostMapping("/sellers/{sellerId}/follow")
    public ResponseEntity<Map<String, Boolean>> follow(@PathVariable Long sellerId, @CurrentUser Long userId) {
        return ResponseEntity.ok(Map.of("following", marketplaceService.toggleFollow(sellerId, userId)));
    }

    @PostMapping("/{listingId}/share")
    public ResponseEntity<Map<String, Long>> share(@PathVariable Long listingId, @CurrentUser Long userId) {
        return ResponseEntity.ok(Map.of("shareCount", marketplaceService.share(listingId, userId)));
    }

    @PostMapping("/{listingId}/report")
    public ResponseEntity<Void> report(@PathVariable Long listingId, @CurrentUser Long userId,
                                       @Valid @RequestBody MarketplaceReportRequest request) {
        marketplaceService.report(listingId, userId, request);
        return ResponseEntity.noContent().build();
    }
}
