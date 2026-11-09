package com.example.messaging.dto.auth;

import com.example.messaging.util.StudentEmailPolicy;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RegisterRequest {
    // Không cho phép ký tự '@' trong username để đăng nhập bằng "username hoặc email" không bị nhập nhằng.
    @NotBlank(message = "Vui lòng nhập username")
    @Size(min = 3, max = 50, message = "Username gồm 3-50 ký tự")
    @Pattern(regexp = "^[A-Za-z0-9_.]+$", message = "Username chỉ gồm chữ, số, dấu chấm và gạch dưới")
    private String username;

    // BCrypt chỉ dùng tối đa 72 byte đầu của mật khẩu
    @NotBlank(message = "Vui lòng nhập mật khẩu")
    @Size(min = 6, max = 72, message = "Mật khẩu gồm 6-72 ký tự")
    private String password;

    @NotBlank(message = "Vui lòng nhập tên hiển thị")
    @Size(max = 100, message = "Tên hiển thị tối đa 100 ký tự")
    private String displayName;

    @NotBlank(message = "Vui lòng nhập email")
    @Pattern(regexp = StudentEmailPolicy.REGEX, message = StudentEmailPolicy.MESSAGE)
    @Size(max = 255, message = "Email quá dài")
    private String email;

    /** Nhận được từ POST /api/auth/register/verify-code. */
    @NotBlank(message = "Email chưa được xác thực")
    private String verificationToken;
}
