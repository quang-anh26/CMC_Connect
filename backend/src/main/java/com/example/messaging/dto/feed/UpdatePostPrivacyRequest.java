package com.example.messaging.dto.feed;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdatePostPrivacyRequest {
    @NotBlank
    @Size(max = 20)
    private String privacy;
}
