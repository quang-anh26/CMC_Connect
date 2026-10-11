package com.example.messaging.dto.marketplace;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MarketplaceReportRequest(
        @NotBlank @Size(max = 20) String targetType,
        @NotBlank @Size(max = 1000) String reason) {}
