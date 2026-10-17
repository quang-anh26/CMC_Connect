package com.example.messaging.controller;

import com.example.messaging.security.CurrentUser;
import com.example.messaging.service.BlockService;
import com.example.messaging.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/blocks")
@RequiredArgsConstructor
public class BlockController {

    private final BlockService blockService;
    private final UserService userService;
    private final SimpMessagingTemplate messagingTemplate;

    @PostMapping("/{userId}")
    public ResponseEntity<Void> block(@CurrentUser Long me, @PathVariable Long userId) {
        blockService.block(me, userId);
        notifyBlockedUser(me, userId, true);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> unblock(@CurrentUser Long me, @PathVariable Long userId) {
        blockService.unblock(me, userId);
        notifyBlockedUser(me, userId, false);
        return ResponseEntity.noContent().build();
    }

    private void notifyBlockedUser(Long blockerId, Long userId, boolean blocked) {
        var event = java.util.Map.of("blockerId", blockerId, "blocked", blocked);
        String blockedUsername = userService.getByIdOrThrow(userId).getUsername();
        String blockerUsername = userService.getByIdOrThrow(blockerId).getUsername();
        messagingTemplate.convertAndSendToUser(blockedUsername, "/queue/block-status", event);
        messagingTemplate.convertAndSendToUser(blockerUsername, "/queue/block-status", event);
    }
}
