package com.example.messaging.util;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Quy tắc email dùng để định danh tài khoản: chỉ chấp nhận email sinh viên CMC
 * có đuôi {@value #DOMAIN}. Dùng chung cho validation DTO và kiểm tra ở service
 * để không ai vượt qua được bằng cách gọi API trực tiếp.
 */
public final class StudentEmailPolicy {
    public static final String DOMAIN = "st.cmcu.edu.vn";
    /** Regex cho @Pattern (không phân biệt hoa/thường). */
    public static final String REGEX = "(?i)^[A-Za-z0-9._%+-]+@st\\.cmcu\\.edu\\.vn$";
    public static final String MESSAGE = "Vui lòng dùng email sinh viên có đuôi @" + DOMAIN;

    private static final Pattern PATTERN = Pattern.compile(REGEX);

    private StudentEmailPolicy() {}

    public static boolean isValid(String email) {
        return email != null && PATTERN.matcher(email.trim().toLowerCase(Locale.ROOT)).matches();
    }
}
