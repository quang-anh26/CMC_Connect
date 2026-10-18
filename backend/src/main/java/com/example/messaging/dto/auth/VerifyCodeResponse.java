package com.example.messaging.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class VerifyCodeResponse {
    /** Token dùng 1 lần, gửi kèm khi gọi POST /api/auth/register. */
    private String verificationToken;
}
