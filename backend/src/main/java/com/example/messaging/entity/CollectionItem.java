package com.example.messaging.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "SAVED_COLLECTION_ITEMS", uniqueConstraints = @UniqueConstraint(
        name = "uq_saved_collection_item", columnNames = {"saved_item_id"}),
        indexes = @Index(name = "idx_saved_collection_items_collection", columnList = "collection_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CollectionItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "saved_item_id", nullable = false, unique = true)
    private SavedItem savedItem;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "collection_id", nullable = false)
    private SavedCollection collection;
}
