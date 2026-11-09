package com.example.messaging.dto.auth;

import com.example.messaging.util.StudentEmailPolicy;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ForgotPasswordSendCodeRequest {
    @NotBlank(message = "Vui lòng nhập email sinh viên")
    @Pattern(regexp = StudentEmailPolicy.REGEX, message = StudentEmailPolicy.MESSAGE)
    @Size(max = 255, message = "Email quá dài")
    private String email;
}
