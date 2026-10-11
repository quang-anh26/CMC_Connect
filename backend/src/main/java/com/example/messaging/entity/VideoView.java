package com.example.messaging.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "VIDEO_VIEW", uniqueConstraints = @UniqueConstraint(columnNames = {"post_id", "viewer_id", "viewed_on"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VideoView {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "post_id", nullable = false, foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
    private SocialPost post;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "viewer_id", nullable = false, foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
    private User viewer;

    @Column(name = "viewed_on", nullable = false)
    private LocalDate viewedOn;

    @PrePersist
    protected void onCreate() { if (viewedOn == null) viewedOn = LocalDate.now(); }
}