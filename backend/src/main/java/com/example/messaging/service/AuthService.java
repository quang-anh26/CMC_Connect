package com.example.messaging.service;

import com.example.messaging.dto.auth.*;
import com.example.messaging.entity.EmailVerification;
import com.example.messaging.util.StudentEmailPolicy;
import com.example.messaging.entity.RefreshToken;
import com.example.messaging.entity.User;
import com.example.messaging.entity.enums.Role;
import com.example.messaging.entity.enums.UserStatus;
import com.example.messaging.exception.ApiException;
import com.example.messaging.repository.UserRepository;
import com.example.messaging.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Implements the login flow from plan section 6:
 * React -> POST /api/auth/login -> Spring Security -> check BCrypt ->
 * return Access Token (JWT) + Refresh Token.
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;
    private final RefreshTokenService refreshTokenService;
    private final EmailVerificationService emailVerificationService;

    public SendCodeResponse sendRegisterCode(SendCodeRequest request) {
        boolean emailSent = emailVerificationService.requestCode(request.getEmail());
        return SendCodeResponse.builder()
                .emailSent(emailSent)
                .resendCooldownSeconds(emailVerificationService.getResendCooldownSeconds())
                .codeExpiresInSeconds(emailVerificationService.getCodeTtlSeconds())
                .build();
    }

    public VerifyCodeResponse verifyRegisterCode(VerifyCodeRequest request) {
        String token = emailVerificationService.verifyCode(request.getEmail(), request.getCode());
        return VerifyCodeResponse.builder().verificationToken(token).build();
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = EmailVerificationService.normalizeEmail(request.getEmail());
        if (!StudentEmailPolicy.isValid(email)) throw ApiException.badRequest(StudentEmailPolicy.MESSAGE);

        // Email phải đã được xác thực bằng mã trước khi tạo tài khoản
        EmailVerification verification = emailVerificationService.requireVerified(email, request.getVerificationToken());

        if (userRepository.existsByUsername(request.getUsername())) {
            throw ApiException.conflict("Username đã tồn tại");
        }
        if (userRepository.existsByEmail(email)) {
            throw ApiException.conflict("Email này đã được dùng cho một tài khoản");
        }

        User user = User.builder()
                .username(request.getUsername())
                .email(email)
                .password(passwordEncoder.encode(request.getPassword())) // BCrypt
                .displayName(request.getDisplayName().trim())
                .role(Role.USER)
                .status(UserStatus.ACTIVE)
                .build();

        user = userRepository.save(user);
        emailVerificationService.discard(verification); // token chỉ dùng một lần
        return issueTokens(user);
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        // Cho phép đăng nhập bằng username HOẶC email (username không chứa '@')
        String identifier = request.getUsername().trim();
        User user;
        if (identifier.contains("@")) {
            // Một email có thể có nhiều tài khoản: chỉ đăng nhập bằng email khi email đó có đúng 1 tài khoản
            List<User> accounts = userRepository.findAllByEmail(EmailVerificationService.normalizeEmail(identifier));
            if (accounts.isEmpty()) {
                throw ApiException.unauthorized("Sai tài khoản hoặc mật khẩu");
            }
            if (accounts.size() > 1) {
                throw ApiException.badRequest(
                        "Email này được dùng cho nhiều tài khoản. Vui lòng đăng nhập bằng username");
            }
            user = accounts.get(0);
        } else {
            user = userRepository.findByUsername(identifier)
                    .orElseThrow(() -> ApiException.unauthorized("Sai tài khoản hoặc mật khẩu"));
        }

        if (user.getStatus() == UserStatus.LOCKED) {
            throw ApiException.forbidden("Tài khoản đã bị khóa");
        }

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(user.getUsername(), request.getPassword()));
        } catch (BadCredentialsException e) {
            throw ApiException.unauthorized("Sai tài khoản hoặc mật khẩu");
        }

        return issueTokens(user);
    }

    @Transactional
    public AuthResponse refresh(RefreshTokenRequest request) {
        RefreshToken refreshToken = refreshTokenService.verify(request.getRefreshToken());
        User user = refreshToken.getUser();

        // Issue a brand-new Access Token; keep the same refresh token (rotate if you prefer higher security)
        String newAccessToken = jwtUtil.generateAccessToken(user.getUserId(), user.getUsername(), user.getRole().name());

        return AuthResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(refreshToken.getToken())
                .userId(user.getUserId())
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .role(user.getRole().name())
                .build();
    }

    @Transactional
    public void logout(Long userId) {
        refreshTokenService.revokeAllForUser(userId);
    }

    private AuthResponse issueTokens(User user) {
        String accessToken = jwtUtil.generateAccessToken(user.getUserId(), user.getUsername(), user.getRole().name());
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(user);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken.getToken())
                .userId(user.getUserId())
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .role(user.getRole().name())
                .build();
    }
}
