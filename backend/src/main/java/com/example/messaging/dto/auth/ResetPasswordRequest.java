package com.example.messaging.dto.auth;

import com.example.messaging.util.StudentEmailPolicy;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ResetPasswordRequest {
    @NotBlank(message = "Vui lòng nhập email sinh viên")
    @Pattern(regexp = StudentEmailPolicy.REGEX, message = StudentEmailPolicy.MESSAGE)
    @Size(max = 255, message = "Email quá dài")
    private String email;

    /** Nhận được từ POST /api/auth/forgot-password/verify-code. */
    @NotBlank(message = "Phiên xác thực đã hết hạn. Vui lòng thử lại")
    private String resetToken;

    @NotNull(message = "Vui lòng chọn tài khoản cần đổi mật khẩu")
    private Long userId;

    // BCrypt chỉ dùng tối đa 72 byte đầu của mật khẩu
    @NotBlank(message = "Vui lòng nhập mật khẩu mới")
    @Size(min = 6, max = 72, message = "Mật khẩu gồm 6-72 ký tự")
    private String newPassword;
}
