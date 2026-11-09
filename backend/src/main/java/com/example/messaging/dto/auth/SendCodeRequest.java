package com.example.messaging.dto.auth;

import com.example.messaging.util.StudentEmailPolicy;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SendCodeRequest {
    @NotBlank(message = "Vui lòng nhập email")
    @Pattern(regexp = StudentEmailPolicy.REGEX, message = StudentEmailPolicy.MESSAGE)
    @Size(max = 255, message = "Email quá dài")
    private String email;
}
