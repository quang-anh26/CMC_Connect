package com.example.messaging.repository;

import com.example.messaging.entity.CollectionItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CollectionItemRepository extends JpaRepository<CollectionItem, Long> {
    Optional<CollectionItem> findBySavedItemSavedItemId(Long savedItemId);
    long countByCollectionCollectionId(Long collectionId);
    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM CollectionItem ci WHERE ci.savedItem.savedItemId = :savedItemId")
    int unlinkSavedItem(@Param("savedItemId") Long savedItemId);
    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM CollectionItem ci WHERE ci.collection.collectionId = :collectionId")
    int unlinkCollection(@Param("collectionId") Long collectionId);
}
