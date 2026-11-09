package com.example.messaging.forum.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "forum_majors", uniqueConstraints = {
        @UniqueConstraint(name = "uq_forum_major_faculty_name", columnNames = {"faculty_id", "name"})
})
@Getter
@Setter
@NoArgsConstructor
public class ForumMajor {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "faculty_id", nullable = false)
    private ForumFaculty faculty;

    @Column(nullable = false, length = 180)
    private String name;

    @Column(nullable = false)
    private boolean active = true;

    private LocalDateTime createdAt;

    @PrePersist
    void create() {
        createdAt = LocalDateTime.now();
    }
}
