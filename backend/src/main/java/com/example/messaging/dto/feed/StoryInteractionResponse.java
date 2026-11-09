package com.example.messaging.dto.feed;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.Map;

@Value
@Builder
public class StoryInteractionResponse {
    Long storyId;
    long reactionCount;
    /** Số lượng theo từng loại: LIKE, LOVE, HAHA, WOW, SAD, ANGRY */
    Map<String, Long> reactionCounts;
    /** Cảm xúc của người đang xem (null nếu chưa chọn) */
    String viewerReaction;
    List<StoryCommentResponse> comments;
}
