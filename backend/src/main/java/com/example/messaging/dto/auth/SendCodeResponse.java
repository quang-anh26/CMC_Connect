package com.example.messaging.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class SendCodeResponse {
    /** false khi server đang ở chế độ DEV (chưa cấu hình SMTP): mã chỉ hiện trong console backend. */
    private boolean emailSent;
    private long resendCooldownSeconds;
    private long codeExpiresInSeconds;
}
