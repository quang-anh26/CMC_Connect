package com.example.messaging.dto.feed;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdatePostRequest {
    @Size(max = 10000)
    private String content;
}
