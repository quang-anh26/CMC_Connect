package com.example.messaging.controller;

import com.example.messaging.dto.chat.MessageRequest;
import com.example.messaging.dto.chat.MessageResponse;
import com.example.messaging.dto.chat.MessageReactionRequest;
import com.example.messaging.dto.chat.MessageReactionUpdate;
import com.example.messaging.security.CurrentUser;
import com.example.messaging.service.FileStorageService;
import com.example.messaging.service.MessageService;
import jakarta.validation.Valid;
<<<<<<< HEAD
import org.springframework.messaging.simp.SimpMessagingTemplate;
=======
>>>>>>> origin/main
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * REST endpoints for chat history + file upload + recall.
 * Real-time send/receive/typing/seen happen over WebSocket/STOMP (see websocket package) -
 * REST here covers pagination (lazy loading) and actions that don't need to be push-based.
 */
@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;
    private final FileStorageService fileStorageService;
    private final SimpMessagingTemplate messagingTemplate;
<<<<<<< HEAD
=======

    @PostMapping
    public ResponseEntity<MessageResponse> send(@CurrentUser Long userId,
                                                 @Valid @RequestBody MessageRequest request) {
        MessageResponse saved = messageService.sendMessage(userId, request);
        messagingTemplate.convertAndSend("/topic/conversation/" + request.getConversationId(), saved);
        return ResponseEntity.ok(saved);
    }
>>>>>>> origin/main

    /** Lazy loading history: 20 messages/page. page=0 is the most recent 20. */
    @GetMapping("/conversation/{conversationId}")
    public ResponseEntity<List<MessageResponse>> history(@CurrentUser Long userId,
                                                           @PathVariable Long conversationId,
                                                           @RequestParam(defaultValue = "0") int page) {
        return ResponseEntity.ok(messageService.getHistory(conversationId, userId, page));
    }

    @PutMapping("/{messageId}")
    public ResponseEntity<MessageResponse> edit(@CurrentUser Long userId,
                                              @PathVariable Long messageId,
                                              @Valid @RequestBody Map<String, String> payload) {
        String content = payload.get("content");
        MessageResponse updated = messageService.editMessage(messageId, userId, content);
        messagingTemplate.convertAndSend(
                "/topic/conversation/" + updated.getConversationId(),
                updated);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{messageId}/recall")
    public ResponseEntity<MessageResponse> recall(@CurrentUser Long userId, @PathVariable Long messageId) {
        return ResponseEntity.ok(messageService.recall(messageId, userId));
    }

    @PostMapping("/{messageId}/reaction")
    public ResponseEntity<MessageReactionUpdate> react(
            @CurrentUser Long userId,
            @PathVariable Long messageId,
            @Valid @RequestBody MessageReactionRequest request) {
        request.setMessageId(messageId);
        MessageReactionUpdate updated = messageService.toggleReaction(userId, request);
        messagingTemplate.convertAndSend(
                "/topic/conversation/" + updated.getConversationId() + "/reactions", updated);
        return ResponseEntity.ok(updated);
    }

    @PostMapping(value = "/upload", consumes = "multipart/form-data")
    public ResponseEntity<Map<String, String>> upload(@RequestParam("file") MultipartFile file) {
        String url = fileStorageService.store(file);
        return ResponseEntity.ok(Map.of("url", url));
    }
}
