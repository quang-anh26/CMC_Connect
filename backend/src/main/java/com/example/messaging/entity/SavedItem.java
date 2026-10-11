package com.example.messaging.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "SAVED_ITEMS", uniqueConstraints = @UniqueConstraint(
        name = "uq_saved_item_owner_content", columnNames = {"user_id", "content_type", "content_id"}),
        indexes = @Index(name = "idx_saved_item_owner_time", columnList = "user_id, saved_at"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SavedItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "saved_item_id")
    private Long savedItemId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "content_type", nullable = false, length = 20)
    private String contentType;

    @Column(name = "content_id", nullable = false)
    private Long contentId;

    @Column(name = "saved_at", nullable = false, updatable = false)
    private LocalDateTime savedAt;

    @OneToOne(mappedBy = "savedItem", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private CollectionItem collectionItem;

    @PrePersist
    protected void onCreate() {
        if (savedAt == null) savedAt = LocalDateTime.now();
    }
}
