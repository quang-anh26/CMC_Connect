package com.example.messaging.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "GROUP_POLL_OPTIONS")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupPollOption {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "poll_id", nullable = false)
    private GroupPoll poll;

    @Column(nullable = false, length = 120)
    private String label;
}