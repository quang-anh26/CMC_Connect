package com.example.messaging.controller;

import com.example.messaging.dto.saved.*;
import com.example.messaging.security.CurrentUser;
import com.example.messaging.service.SavedService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/saved")
@RequiredArgsConstructor
public class SavedController {
    private final SavedService savedService;

    @GetMapping
    public ResponseEntity<Page<SavedItemResponse>> list(
            @CurrentUser Long userId,
            @RequestParam(defaultValue = "ALL") String type,
            @RequestParam(defaultValue = "") String q,
            @RequestParam(required = false) Long collectionId,
            @RequestParam(defaultValue = "NEWEST") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size) {
        return ResponseEntity.ok(savedService.list(userId, type, q, collectionId, sort, page, size));
    }

    @PostMapping("/toggle")
    public ResponseEntity<Map<String, Object>> toggle(@CurrentUser Long userId, @Valid @RequestBody SaveItemRequest request) {
        return ResponseEntity.ok(savedService.toggle(userId, request));
    }

    @DeleteMapping("/items/{savedItemId}")
    public ResponseEntity<Void> unsave(@CurrentUser Long userId, @PathVariable Long savedItemId) {
        savedService.unsave(savedItemId, userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/collections")
    public ResponseEntity<List<SavedCollectionResponse>> collections(@CurrentUser Long userId) {
        return ResponseEntity.ok(savedService.collections(userId));
    }

    @PostMapping("/collections")
    public ResponseEntity<SavedCollectionResponse> createCollection(
            @CurrentUser Long userId, @Valid @RequestBody SavedCollectionRequest request) {
        return ResponseEntity.ok(savedService.createCollection(userId, request));
    }

    @PutMapping("/collections/{collectionId}")
    public ResponseEntity<SavedCollectionResponse> renameCollection(
            @CurrentUser Long userId, @PathVariable Long collectionId,
            @Valid @RequestBody SavedCollectionRequest request) {
        return ResponseEntity.ok(savedService.renameCollection(collectionId, userId, request));
    }

    @DeleteMapping("/collections/{collectionId}")
    public ResponseEntity<Void> deleteCollection(@CurrentUser Long userId, @PathVariable Long collectionId) {
        savedService.deleteCollection(collectionId, userId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/items/{savedItemId}/collection/{collectionId}")
    public ResponseEntity<Void> addToCollection(@CurrentUser Long userId, @PathVariable Long savedItemId,
                                                 @PathVariable Long collectionId) {
        savedService.addToCollection(savedItemId, collectionId, userId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/items/{savedItemId}/collection")
    public ResponseEntity<Void> removeFromCollection(@CurrentUser Long userId, @PathVariable Long savedItemId) {
        savedService.removeFromCollection(savedItemId, userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Boolean>> isSaved(@CurrentUser Long userId,
                                                        @RequestParam String type,
                                                        @RequestParam Long contentId) {
        return ResponseEntity.ok(Map.of("saved", savedService.isSaved(userId, type, contentId)));
    }
}
