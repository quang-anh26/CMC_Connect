package com.example.messaging.service;

import com.example.messaging.entity.EmailVerification;
import com.example.messaging.exception.ApiException;
import com.example.messaging.repository.UserRepository;
import com.example.messaging.util.StudentEmailPolicy;
import com.example.messaging.repository.EmailVerificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;

/**
 * Xác thực email khi đăng ký:
 *  1. requestCode  - gửi mã 6 số về email
 *  2. verifyCode   - nhập đúng mã -> nhận verificationToken (dùng 1 lần)
 *  3. AuthService.register dùng consume/validate token để tạo tài khoản
 */
@Service
@RequiredArgsConstructor
public class EmailVerificationService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final EmailVerificationRepository verificationRepository;
    private final MailService mailService;
    private final UserRepository userRepository;

    @Value("${app.jwt.secret}")
    private String hashSecret; // dùng làm "pepper" khi hash mã/token

    @Value("${app.auth.email-verification.code-ttl-minutes:10}")
    private long codeTtlMinutes;

    @Value("${app.auth.email-verification.resend-cooldown-seconds:60}")
    private long resendCooldownSeconds;

    @Value("${app.auth.email-verification.max-attempts:5}")
    private int maxAttempts;

    @Value("${app.auth.email-verification.max-sends-per-hour:5}")
    private int maxSendsPerHour;

    @Value("${app.auth.email-verification.verified-token-ttl-minutes:15}")
    private long verifiedTokenTtlMinutes;

    public long getCodeTtlSeconds() {
        return codeTtlMinutes * 60;
    }

    public long getResendCooldownSeconds() {
        return resendCooldownSeconds;
    }

    /** Mục đích của mã: gắn vào hash để mã/token của luồng này không dùng được cho luồng kia. */
    public enum Purpose {
        REGISTER("code", "token"),
        RESET_PASSWORD("reset-code", "reset-token");

        private final String codeKey;
        private final String tokenKey;

        Purpose(String codeKey, String tokenKey) {
            this.codeKey = codeKey;
            this.tokenKey = tokenKey;
        }
    }

    public static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    /** Bước 1: tạo và gửi mã xác thực. Nếu gửi mail lỗi thì rollback để người dùng thử lại ngay. */
    @Transactional
    public boolean requestCode(String rawEmail) {
        return requestCode(rawEmail, Purpose.REGISTER);
    }

    @Transactional
    public boolean requestCode(String rawEmail, Purpose purpose) {
        String email = normalizeEmail(rawEmail);

        // Việc email đã có/chưa có tài khoản do AuthService kiểm tra trước khi gọi vào đây.

        LocalDateTime now = LocalDateTime.now();
        EmailVerification verification = verificationRepository.findByEmail(email)
                .orElseGet(() -> EmailVerification.builder().email(email).createdAt(now).build());

        // Giới hạn tốc độ: cooldown giữa 2 lần gửi
        if (verification.getLastSentAt() != null) {
            LocalDateTime nextAllowed = verification.getLastSentAt().plusSeconds(resendCooldownSeconds);
            if (nextAllowed.isAfter(now)) {
                long wait = Duration.between(now, nextAllowed).getSeconds() + 1;
                throw new ApiException("Vui lòng đợi " + wait + " giây trước khi gửi lại mã",
                        HttpStatus.TOO_MANY_REQUESTS);
            }
        }

        // Giới hạn số lần gửi mỗi giờ cho một email
        if (verification.getSendWindowStart() == null
                || verification.getSendWindowStart().plusHours(1).isBefore(now)) {
            verification.setSendWindowStart(now);
            verification.setSendCount(0);
        }
        if (verification.getSendCount() >= maxSendsPerHour) {
            throw new ApiException("Bạn đã yêu cầu mã quá nhiều lần. Vui lòng thử lại sau ít phút",
                    HttpStatus.TOO_MANY_REQUESTS);
        }

        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        verification.setCodeHash(hash(purpose.codeKey, email, code));
        verification.setExpiresAt(now.plusMinutes(codeTtlMinutes));
        verification.setAttempts(0);
        verification.setLastSentAt(now);
        verification.setSendCount(verification.getSendCount() + 1);
        verification.setVerifiedTokenHash(null);
        verification.setVerifiedExpiresAt(null);
        verificationRepository.save(verification);

        return mailService.sendVerificationCode(email, code, codeTtlMinutes, purpose == Purpose.RESET_PASSWORD);
    }

    /**
     * Bước 2: kiểm tra mã. noRollbackFor để số lần nhập sai vẫn được lưu
     * dù ném exception (nếu không, kẻ tấn công có thể dò mã vô hạn).
     */
    @Transactional(noRollbackFor = ApiException.class)
    public String verifyCode(String rawEmail, String rawCode) {
        return verifyCode(rawEmail, rawCode, Purpose.REGISTER);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public String verifyCode(String rawEmail, String rawCode, Purpose purpose) {
        String email = normalizeEmail(rawEmail);
        String code = rawCode == null ? "" : rawCode.trim();
        LocalDateTime now = LocalDateTime.now();

        EmailVerification verification = verificationRepository.findByEmail(email)
                .orElseThrow(() -> ApiException.badRequest("Mã xác thực không hợp lệ. Vui lòng gửi lại mã mới"));

        if (verification.getCodeHash() == null || verification.getExpiresAt().isBefore(now)) {
            throw ApiException.badRequest("Mã xác thực đã hết hạn. Vui lòng gửi lại mã mới");
        }
        if (verification.getAttempts() >= maxAttempts) {
            throw new ApiException("Bạn đã nhập sai quá nhiều lần. Vui lòng gửi lại mã mới",
                    HttpStatus.TOO_MANY_REQUESTS);
        }

        if (!constantTimeEquals(verification.getCodeHash(), hash(purpose.codeKey, email, code))) {
            verification.setAttempts(verification.getAttempts() + 1);
            verificationRepository.save(verification);
            int remaining = maxAttempts - verification.getAttempts();
            if (remaining <= 0) {
                throw new ApiException("Bạn đã nhập sai quá nhiều lần. Vui lòng gửi lại mã mới",
                        HttpStatus.TOO_MANY_REQUESTS);
            }
            throw ApiException.badRequest("Mã xác thực không đúng. Bạn còn " + remaining + " lần thử");
        }

        byte[] raw = new byte[32];
        RANDOM.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);

        verification.setCodeHash(null); // mã chỉ dùng được một lần
        verification.setVerifiedTokenHash(hash(purpose.tokenKey, email, token));
        verification.setVerifiedExpiresAt(now.plusMinutes(verifiedTokenTtlMinutes));
        verificationRepository.save(verification);
        return token;
    }

    /** Bước 3 (trong register): kiểm tra token hợp lệ cho email. Trả về bản ghi để xóa sau khi tạo user. */
    public EmailVerification requireVerified(String rawEmail, String token) {
        return requireVerified(rawEmail, token, Purpose.REGISTER);
    }

    public EmailVerification requireVerified(String rawEmail, String token, Purpose purpose) {
        String email = normalizeEmail(rawEmail);
        EmailVerification verification = verificationRepository.findByEmail(email)
                .orElseThrow(() -> ApiException.badRequest("Email chưa được xác thực"));

        if (verification.getVerifiedTokenHash() == null
                || verification.getVerifiedExpiresAt() == null
                || verification.getVerifiedExpiresAt().isBefore(LocalDateTime.now())) {
            throw ApiException.badRequest("Phiên xác thực email đã hết hạn. Vui lòng xác thực lại");
        }
        if (token == null || !constantTimeEquals(verification.getVerifiedTokenHash(), hash(purpose.tokenKey, email, token))) {
            throw ApiException.badRequest("Phiên xác thực email không hợp lệ. Vui lòng xác thực lại");
        }
        return verification;
    }

    public void discard(EmailVerification verification) {
        verificationRepository.delete(verification);
    }

    private String hash(String purpose, String email, String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String input = purpose + "|" + email + "|" + value + "|" + hashSecret;
            return HexFormat.of().formatHex(digest.digest(input.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private boolean constantTimeEquals(String a, String b) {
        return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }
}
