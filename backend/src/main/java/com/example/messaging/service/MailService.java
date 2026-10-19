package com.example.messaging.service;

import com.example.messaging.exception.ApiException;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

/**
 * Gửi email. Khi app.mail.enabled=false (mặc định) mã xác thực chỉ được in ra log
 * để có thể test mà không cần cấu hình SMTP.
 */
@Slf4j
@Service
public class MailService {

    private final ObjectProvider<JavaMailSender> mailSenderProvider;

    @Value("${app.mail.enabled:false}")
    private boolean enabled;

    @Value("${app.mail.from:}")
    private String from;

    @Value("${spring.mail.username:}")
    private String smtpUsername;

    public MailService(ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.mailSenderProvider = mailSenderProvider;
    }

    @Value("${spring.mail.password:}")
    private String smtpPassword;

    /** Tự bật gửi mail thật khi đã khai báo MAIL_USERNAME + MAIL_PASSWORD, không cần thêm MAIL_ENABLED. */
    private boolean isMailActive() {
        boolean hasCredentials = smtpUsername != null && !smtpUsername.isBlank()
                && smtpPassword != null && !smtpPassword.isBlank();
        return enabled || hasCredentials;
    }

    /** In trạng thái cấu hình ngay khi backend khởi động để biết file cấu hình đã được đọc hay chưa. */
    @EventListener(ApplicationReadyEvent.class)
    public void logMailStatus() {
        if (isMailActive()) {
            String user = (smtpUsername == null || smtpUsername.isBlank()) ? "(trống)" : smtpUsername;
            boolean hasPassword = smtpPassword != null && !smtpPassword.isBlank();
            log.info("[MAIL] Gửi email: BẬT | tài khoản SMTP: {} | mật khẩu: {} | máy chủ: {}",
                    user, hasPassword ? "đã khai báo" : "CHƯA khai báo", "smtp.gmail.com:587 (mặc định)");
        } else {
            log.warn("[MAIL] Gửi email: TẮT - chưa đọc được MAIL_USERNAME/MAIL_PASSWORD. "
                    + "Kiểm tra backend/application-local.yml (đúng tên, đúng thư mục, đã khởi động lại backend).");
        }
    }

    /**
     * @return true nếu email thật đã được gửi đi; false nếu đang ở chế độ DEV (chỉ in mã ra console).
     */
    public boolean sendVerificationCode(String to, String code, long ttlMinutes) {
        if (!isMailActive()) {
            log.warn("""
                    =====================================================================
                    [DEV] CHƯA CẤU HÌNH GỬI EMAIL nên KHÔNG có mail nào được gửi tới {}.
                    Mã xác thực để test: {}
                    Muốn gửi mail thật: tạo file backend/application-local.yml (xem application-local.example.yml)
                    hoặc đặt biến môi trường MAIL_USERNAME + MAIL_PASSWORD (Gmail App Password).
                    =====================================================================""", to, code);
            return false;
        }

        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        if (sender == null) {
            log.error("Chưa cấu hình JavaMailSender (spring.mail.*)");
            throw new ApiException("Hệ thống gửi email chưa được cấu hình", HttpStatus.SERVICE_UNAVAILABLE);
        }

        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            String fromAddress = (from != null && !from.isBlank()) ? from : smtpUsername;
            if (fromAddress != null && !fromAddress.isBlank()) {
                helper.setFrom(fromAddress, "CMC Talk");
            }
            helper.setTo(to);
            helper.setSubject("CMC Talk - Mã xác thực của bạn là " + code);
            helper.setText(buildHtml(code, ttlMinutes), true);
            sender.send(message);
            log.info("Đã gửi email xác thực tới {}", to);
            return true;
        } catch (MailAuthenticationException e) {
            // Sai MAIL_USERNAME/MAIL_PASSWORD (Gmail yêu cầu App Password 16 ký tự, không dùng mật khẩu đăng nhập)
            log.error("Đăng nhập SMTP thất bại - kiểm tra MAIL_USERNAME / MAIL_PASSWORD (Gmail phải dùng App Password): {}",
                    rootMessage(e), e);
            throw new ApiException("Máy chủ gửi email cấu hình sai tài khoản SMTP. Vui lòng liên hệ quản trị viên",
                    HttpStatus.SERVICE_UNAVAILABLE);
        } catch (MailException | MessagingException | java.io.UnsupportedEncodingException e) {
            log.error("Không gửi được email xác thực tới {}: {}", to, rootMessage(e), e);
            throw new ApiException("Không thể gửi email xác thực. Vui lòng thử lại sau", HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    private static String rootMessage(Throwable t) {
        Throwable root = t;
        while (root.getCause() != null && root.getCause() != root) root = root.getCause();
        return root.getClass().getSimpleName() + ": " + root.getMessage();
    }

    private String buildHtml(String code, long ttlMinutes) {
        return "<div style=\"font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;"
                + "border:1px solid #e4e6eb;border-radius:12px\">"
                + "<h2 style=\"margin:0 0 8px;color:#0b5fd6\">CMC Talk</h2>"
                + "<p style=\"color:#333;font-size:15px\">Mã xác thực email đăng ký tài khoản của bạn:</p>"
                + "<p style=\"font-size:34px;font-weight:700;letter-spacing:8px;margin:18px 0;color:#111\">" + code + "</p>"
                + "<p style=\"color:#555;font-size:14px\">Mã có hiệu lực trong " + ttlMinutes + " phút. "
                + "Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</p>"
                + "<p style=\"color:#888;font-size:12px\">Nếu bạn không yêu cầu đăng ký, hãy bỏ qua email này.</p>"
                + "</div>";
    }
}
