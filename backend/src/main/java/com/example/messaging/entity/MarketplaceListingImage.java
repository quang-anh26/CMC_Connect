package com.example.messaging.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "MARKETPLACE_LISTING_IMAGES")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MarketplaceListingImage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "image_id")
    private Long imageId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "listing_id", nullable = false)
    private MarketplaceListing listing;

    @Column(nullable = false, length = 1000)
    private String imageUrl;

    @Column(name = "image_order", nullable = false)
    private int imageOrder;
}
