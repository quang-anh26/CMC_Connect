package com.example.messaging.controller;

import com.example.messaging.dto.feed.FeedPostResponse;
import com.example.messaging.security.CurrentUser;
import com.example.messaging.service.FeedService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/explore")
@RequiredArgsConstructor
public class ExploreController {

    private final FeedService feedService;

    @GetMapping("/posts")
    public ResponseEntity<Page<FeedPostResponse>> posts(
            @CurrentUser Long userId,
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "false") boolean videos,
            @RequestParam(defaultValue = "true") boolean popular,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size) {
        return ResponseEntity.ok(feedService.searchForExplore(q, videos, popular, false, false, userId, page, size));
    }
}