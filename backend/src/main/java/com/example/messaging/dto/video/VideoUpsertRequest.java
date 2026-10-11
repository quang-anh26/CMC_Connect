package com.example.messaging.dto.video;

import jakarta.validation.constraints.Size;

public record VideoUpsertRequest(
        @Size(max = 10000) String content,
        @Size(max = 1000) String imageUrl,
        @Size(max = 20) String privacy) {}