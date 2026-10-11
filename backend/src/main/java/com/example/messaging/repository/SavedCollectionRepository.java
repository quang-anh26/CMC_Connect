package com.example.messaging.repository;

import com.example.messaging.entity.SavedCollection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SavedCollectionRepository extends JpaRepository<SavedCollection, Long> {
    List<SavedCollection> findByUserUserIdOrderByCreatedAtAsc(Long userId);
    Optional<SavedCollection> findByCollectionIdAndUserUserId(Long collectionId, Long userId);
}
