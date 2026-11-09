package com.example.messaging.controller;

import com.example.messaging.dto.auth.*;
import com.example.messaging.security.CurrentUser;
import com.example.messaging.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /** Bước 1 đăng ký: gửi mã xác thực 6 số tới email. */
    @PostMapping("/register/send-code")
    public ResponseEntity<SendCodeResponse> sendRegisterCode(@Valid @RequestBody SendCodeRequest request) {
        return ResponseEntity.ok(authService.sendRegisterCode(request));
    }

    /** Bước 2 đăng ký: nhập mã, nhận verificationToken. */
    @PostMapping("/register/verify-code")
    public ResponseEntity<VerifyCodeResponse> verifyRegisterCode(@Valid @RequestBody VerifyCodeRequest request) {
        return ResponseEntity.ok(authService.verifyRegisterCode(request));
    }

    /** Bước 3 đăng ký: tạo tài khoản (kèm email + verificationToken). */
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    /** Quên mật khẩu - bước 1: gửi mã 6 số tới email sinh viên đã đăng ký. */
    @PostMapping("/forgot-password/send-code")
    public ResponseEntity<SendCodeResponse> sendForgotPasswordCode(
            @Valid @RequestBody ForgotPasswordSendCodeRequest request) {
        return ResponseEntity.ok(authService.sendForgotPasswordCode(request));
    }

    /** Quên mật khẩu - bước 2: nhập mã, nhận resetToken + danh sách tài khoản của email. */
    @PostMapping("/forgot-password/verify-code")
    public ResponseEntity<ForgotPasswordVerifyResponse> verifyForgotPasswordCode(
            @Valid @RequestBody ForgotPasswordVerifyRequest request) {
        return ResponseEntity.ok(authService.verifyForgotPasswordCode(request));
    }

    /** Quên mật khẩu - bước 3: chọn tài khoản và đặt mật khẩu mới. */
    @PostMapping("/forgot-password/reset")
    public ResponseEntity<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return ResponseEntity.ok(authService.refresh(request));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@CurrentUser Long userId) {
        authService.logout(userId);
        return ResponseEntity.noContent().build();
    }
}
