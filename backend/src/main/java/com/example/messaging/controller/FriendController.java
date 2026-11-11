package com.example.messaging.controller;

import com.example.messaging.dto.friend.FriendRequestResponse;
import com.example.messaging.dto.friend.SendFriendRequestRequest;
import com.example.messaging.security.CurrentUser;
import com.example.messaging.service.FriendService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/friends")
@RequiredArgsConstructor
public class FriendController {

    private final FriendService friendService;

    @PostMapping("/requests")
    public ResponseEntity<FriendRequestResponse> send(@CurrentUser Long userId,
                                                        @Valid @RequestBody SendFriendRequestRequest request) {
        return ResponseEntity.ok(friendService.sendRequest(userId, request.getReceiverId()));
    }

    @DeleteMapping("/requests/{id}")
    public ResponseEntity<Void> cancel(@CurrentUser Long userId, @PathVariable Long id) {
        friendService.cancelRequest(id, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/requests/{id}/accept")
    public ResponseEntity<FriendRequestResponse> accept(@CurrentUser Long userId, @PathVariable Long id) {
        return ResponseEntity.ok(friendService.respond(id, userId, true));
    }

    @PostMapping("/requests/{id}/reject")
    public ResponseEntity<FriendRequestResponse> reject(@CurrentUser Long userId, @PathVariable Long id) {
        return ResponseEntity.ok(friendService.respond(id, userId, false));
    }

    @GetMapping("/requests/received")
    public ResponseEntity<List<FriendRequestResponse>> received(@CurrentUser Long userId) {
        return ResponseEntity.ok(friendService.getPendingReceived(userId));
    }

    @GetMapping("/requests/sent")
    public ResponseEntity<List<FriendRequestResponse>> sent(@CurrentUser Long userId) {
        return ResponseEntity.ok(friendService.getPendingSent(userId));
    }

    @GetMapping("/accepted")
    public ResponseEntity<List<FriendRequestResponse>> accepted(@CurrentUser Long userId) {
        return ResponseEntity.ok(friendService.getAccepted(userId));
    }
}
