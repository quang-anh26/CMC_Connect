package com.example.messaging.dto.feed;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

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

    /** Đăng nhiều ảnh/video cùng lúc (tối đa 10). Nếu có thì ưu tiên hơn imageUrl/mediaType. */
    @Valid
    @Size(max = 10)
    private List<PostMediaItem> mediaItems;
}