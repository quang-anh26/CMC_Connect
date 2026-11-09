package com.example.messaging.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
public class ForgotPasswordVerifyResponse {
    /** Token dùng 1 lần, gửi kèm khi gọi POST /api/auth/forgot-password/reset. */
    private String resetToken;
    /** Các tài khoản gắn với email này (với quy tắc 1 sinh viên = 1 tài khoản thì chỉ có 1 phần tử). */
    private List<AccountSummary> accounts;

    @Data
    @Builder
    @AllArgsConstructor
    public static class AccountSummary {
        private Long userId;
        private String username;
        private String displayName;
        private String avatar;
    }
}
