package com.example.messaging.entity;

import jakarta.persistence.*;
import lombok.*;

/** Cảm xúc của một người dùng với một tin (mỗi người chỉ có 1 cảm xúc cho mỗi tin). */
@Entity
@Table(name = "social_story_reactions",
        uniqueConstraints = @UniqueConstraint(columnNames = {"story_id", "user_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SocialStoryReaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long reactionId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "story_id", nullable = false)
    private SocialStory story;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 20)
    private String reactionType;
}
