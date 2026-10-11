package com.example.messaging.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "GROUPS")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SocialGroup {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "group_id")
    private Long groupId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(columnDefinition = "NVARCHAR(2000)")
    private String description;

    @Column(length = 500)
    private String avatar;

    @Column(name = "cover_image", length = 500)
    private String coverImage;

    @Column(length = 80)
    private String category;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String visibility = "PUBLIC";

    @Column(name = "post_approval_required", nullable = false)
    @Builder.Default
    private boolean postApprovalRequired = false;

    @Column(name = "spam_keywords", columnDefinition = "NVARCHAR(2000)")
    private String spamKeywords;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}