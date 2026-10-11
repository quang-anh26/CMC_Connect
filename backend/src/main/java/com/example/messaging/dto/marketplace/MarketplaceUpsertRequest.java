package com.example.messaging.dto.marketplace;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

public record MarketplaceUpsertRequest(
        @NotBlank @Size(max = 160) String title,
        @NotBlank @Size(max = 4000) String description,
        @NotNull @DecimalMin(value = "0.01") BigDecimal price,
        @NotBlank @Size(max = 50) String category,
        @NotBlank @Size(max = 20) String condition,
        @NotBlank @Size(max = 160) String location,
        @Size(max = 8) List<@NotBlank @Size(max = 1000) String> imageUrls) {}
