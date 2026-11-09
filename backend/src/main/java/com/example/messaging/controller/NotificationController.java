package com.example.messaging.controller;

import com.example.messaging.security.CurrentUser;
import com.example.messaging.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<?> list(@CurrentUser Long userId) {
        return ResponseEntity.ok(notificationService.list(userId));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<?> unreadCount(@CurrentUser Long userId) {
        return ResponseEntity.ok(Map.of("count", notificationService.unreadCount(userId)));
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<Void> markRead(@PathVariable Long id, @CurrentUser Long userId) {
        notificationService.markRead(id, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/read-all")
    public ResponseEntity<Void> markAllRead(@CurrentUser Long userId) {
        notificationService.markAllRead(userId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @CurrentUser Long userId) {
        notificationService.delete(id, userId);
        return ResponseEntity.noContent().build();
    }
}
