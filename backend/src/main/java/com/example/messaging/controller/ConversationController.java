package com.example.messaging.controller;

import com.example.messaging.dto.chat.ConversationResponse;
import com.example.messaging.dto.chat.CreateGroupRequest;
import com.example.messaging.dto.chat.UpdateConversationDetailsRequest;
import com.example.messaging.dto.chat.MessageResponse;
import com.example.messaging.entity.Conversation;
import com.example.messaging.security.CurrentUser;
import com.example.messaging.service.ConversationService;
import com.example.messaging.service.MessageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/conversations")
@RequiredArgsConstructor
public class ConversationController {

    private final ConversationService conversationService;
    private final MessageService messageService;
    private final SimpMessagingTemplate messagingTemplate;

    @GetMapping
    public ResponseEntity<List<ConversationResponse>> list(@CurrentUser Long userId) {
        return ResponseEntity.ok(conversationService.listForUser(userId));
    }

    @GetMapping("/requests")
    public ResponseEntity<List<ConversationResponse>> messageRequests(@CurrentUser Long userId) {
        return ResponseEntity.ok(conversationService.listMessageRequestsForUser(userId));
    }

    @GetMapping("/archived")
    public ResponseEntity<List<ConversationResponse>> archived(@CurrentUser Long userId) {
        return ResponseEntity.ok(conversationService.listArchivedForUser(userId));
    }

    @PostMapping("/{conversationId}/archive")
    public ResponseEntity<Void> archive(@CurrentUser Long userId,
                                        @PathVariable Long conversationId,
                                        @RequestParam(defaultValue = "true") boolean archived) {
        conversationService.setArchived(conversationId, userId, archived);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{conversationId}/details")
    public ResponseEntity<ConversationResponse> updateDetails(
            @CurrentUser Long userId,
            @PathVariable Long conversationId,
            @Valid @RequestBody UpdateConversationDetailsRequest request) {
        ConversationResponse updated = conversationService.updateDetails(conversationId, userId, request);
        if (request.getNickname() != null) {
            String targetName = request.getTargetUserId() == null
                || request.getTargetUserId().equals(updated.getCurrentUserId())
                ? updated.getCurrentUserDisplayName()
                : updated.getOtherUserDisplayName();
            String nickname = request.getNickname().trim();
            String message = nickname.isEmpty()
                ? updated.getCurrentUserDisplayName() + " đã xóa biệt danh của " + targetName
                : updated.getCurrentUserDisplayName() + " đã đổi biệt danh cho " + targetName + " thành " + nickname;
            MessageResponse systemMessage = messageService.createSystemMessage(conversationId, userId, message);
            messagingTemplate.convertAndSend("/topic/conversation/" + conversationId, systemMessage);
        }
        messagingTemplate.convertAndSend(
            "/topic/conversation/" + conversationId + "/details",
            Map.of("conversationId", conversationId));
        return ResponseEntity.ok(updated);
    }

    /** Chat 1-1: get-or-create a PRIVATE conversation with another user (after friend accepted). */
    @PostMapping("/private/{otherUserId}")
    public ResponseEntity<Map<String, Long>> getOrCreatePrivate(@CurrentUser Long userId,
                                                                  @PathVariable Long otherUserId) {
        Conversation c = conversationService.getOrCreatePrivateConversation(userId, otherUserId);
        return ResponseEntity.ok(Map.of("conversationId", c.getConversationId()));
    }

    @PostMapping("/group")
    public ResponseEntity<Map<String, Long>> createGroup(@CurrentUser Long userId,
                                                           @Valid @RequestBody CreateGroupRequest request) {
        Conversation c = conversationService.createGroup(userId, request);
        return ResponseEntity.ok(Map.of("conversationId", c.getConversationId()));
    }

    @PostMapping("/{conversationId}/members/{memberId}")
    public ResponseEntity<Void> addMember(@CurrentUser Long userId, @PathVariable Long conversationId,
                                           @PathVariable Long memberId) {
        conversationService.addMember(conversationId, userId, memberId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{conversationId}/members/{memberId}")
    public ResponseEntity<Void> removeMember(@CurrentUser Long userId, @PathVariable Long conversationId,
                                              @PathVariable Long memberId) {
        conversationService.removeMember(conversationId, userId, memberId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{conversationId}/leave")
    public ResponseEntity<Void> leave(@CurrentUser Long userId, @PathVariable Long conversationId) {
        conversationService.leaveGroup(conversationId, userId);
        return ResponseEntity.noContent().build();
    }
}
