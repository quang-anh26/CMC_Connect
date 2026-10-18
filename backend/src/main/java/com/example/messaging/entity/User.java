package com.example.messaging.entity;

import com.example.messaging.entity.enums.Role;
import com.example.messaging.entity.enums.UserStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.time.LocalDate;

@Entity
@Table(name = "USERS", uniqueConstraints = {
        @UniqueConstraint(columnNames = "username")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(length = 255)
    private String email; // chữ thường; null với tài khoản tạo trước khi có xác thực email

    @Column(nullable = false)
    private String password; // BCrypt hash

    @Column(name = "display_name", length = 100)
    private String displayName;

    @Column(length = 500)
    private String avatar;

    @Column(name = "cover_image", length = 500)
    private String coverImage;

    @Column(length = 255)
    private String bio;

    @Column(name = "education", length = 120)
    private String education;

    @Column(name = "location", length = 120)
    private String location;

    @Column(name = "relationship_status", length = 40)
    private String relationshipStatus;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Role role = Role.USER;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private UserStatus status = UserStatus.ACTIVE;

    @Column(name = "is_online")
    @Builder.Default
    private boolean online = false;

    @Column(name = "last_seen_at")
    private LocalDateTime lastSeenAt;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
