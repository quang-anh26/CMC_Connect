package com.example.messaging.dto.feed;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class PostReactionSummary {
    String reactionType;
    long count;
}
