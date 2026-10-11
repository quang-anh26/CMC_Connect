package com.example.messaging.dto.video;

import com.example.messaging.dto.feed.FeedPostResponse;

public record VideoCardResponse(
        FeedPostResponse video,
        boolean savedByViewer,
        boolean followingCreator,
        String playbackUrl) {}