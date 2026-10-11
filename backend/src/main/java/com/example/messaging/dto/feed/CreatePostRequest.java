package com.example.messaging.dto.feed;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreatePostRequest {
    @Size(max = 10000)
    private String content;

    @Size(max = 1000)
    private String imageUrl;

    @Size(max = 10)
    private String mediaType;

    @Size(max = 20)
    private String privacy;
}
