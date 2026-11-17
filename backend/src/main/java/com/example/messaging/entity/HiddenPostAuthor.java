package com.example.messaging.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "HIDDEN_POST_AUTHOR", uniqueConstraints = {
        @UniqueConstraint(name = "uk_hidden_post_author_viewer_author", columnNames = {"viewer_id", "author_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HiddenPostAuthor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "viewer_id", nullable = false)
    private User viewer;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;
}
