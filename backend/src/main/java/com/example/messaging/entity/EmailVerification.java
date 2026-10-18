package com.example.messaging.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Trạng thái xác thực email khi đăng ký (mỗi email một dòng).
 *
 * Luồng: gửi mã -> nhập đúng mã (codeHash bị xóa, cấp verifiedToken dùng 1 lần)
 * -> gửi kèm token khi tạo tài khoản -> dòng này bị xóa.
 * Chỉ lưu hash của mã/token, không lưu giá trị gốc.
 */
@Entity
@Table(name = "EMAIL_VERIFICATION", uniqueConstraints = {
        @UniqueConstraint(columnNames = "email")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmailVerification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String email;

    @Column(name = "code_hash", length = 64)
    private String codeHash;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(nullable = false)
    private int attempts;

    @Column(name = "send_count", nullable = false)
    private int sendCount;

    @Column(name = "send_window_start")
    private LocalDateTime sendWindowStart;

    @Column(name = "last_sent_at")
    private LocalDateTime lastSentAt;

    @Column(name = "verified_token_hash", length = 64)
    private String verifiedTokenHash;

    @Column(name = "verified_expires_at")
    private LocalDateTime verifiedExpiresAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }
}
