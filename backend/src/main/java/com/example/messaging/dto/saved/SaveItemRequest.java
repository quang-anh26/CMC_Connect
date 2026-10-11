package com.example.messaging.dto.saved;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SaveItemRequest(
        @NotBlank @Size(max = 20) String contentType,
        @NotNull Long contentId,
        Long collectionId) {}
