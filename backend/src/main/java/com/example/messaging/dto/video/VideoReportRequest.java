package com.example.messaging.dto.video;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record VideoReportRequest(@NotBlank @Size(max = 500) String reason) {}