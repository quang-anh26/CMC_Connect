package com.example.messaging.dto.feed;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Một ảnh hoặc video trong bài viết. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PostMediaItem {
    @Size(max = 1000)
    private String url;

    /** IMAGE hoặc VIDEO (bỏ trống thì tự đoán theo đuôi tệp). */
    @Size(max = 10)
    private String type;
}