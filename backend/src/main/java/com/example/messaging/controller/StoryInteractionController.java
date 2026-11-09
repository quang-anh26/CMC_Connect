package com.example.messaging.controller;

import com.example.messaging.dto.feed.CreateStoryCommentRequest;
import com.example.messaging.dto.feed.StoryInteractionResponse;
import com.example.messaging.security.CurrentUser;
import com.example.messaging.service.StoryInteractionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/stories/{storyId}")
@RequiredArgsConstructor
public class StoryInteractionController {

    private final StoryInteractionService interactionService;

    @GetMapping("/interactions")
    public ResponseEntity<StoryInteractionResponse> get(@CurrentUser Long userId, @PathVariable Long storyId) {
        return ResponseEntity.ok(interactionService.get(userId, storyId));
    }

    @PostMapping("/reaction")
    public ResponseEntity<StoryInteractionResponse> react(@CurrentUser Long userId,
                                                          @PathVariable Long storyId,
                                                          @RequestParam String reactionType) {
        return ResponseEntity.ok(interactionService.react(userId, storyId, reactionType));
    }

    @PostMapping("/comments")
    public ResponseEntity<StoryInteractionResponse> comment(@CurrentUser Long userId,
                                                            @PathVariable Long storyId,
                                                            @RequestBody CreateStoryCommentRequest request) {
        return ResponseEntity.ok(interactionService.comment(userId, storyId, request.getContent()));
    }

    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<StoryInteractionResponse> deleteComment(@CurrentUser Long userId,
                                                                  @PathVariable Long storyId,
                                                                  @PathVariable Long commentId) {
        return ResponseEntity.ok(interactionService.deleteComment(userId, storyId, commentId));
    }
}
