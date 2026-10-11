package com.example.messaging.dto.saved;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SavedCollectionRequest(@NotBlank @Size(max = 80) String name) {}
