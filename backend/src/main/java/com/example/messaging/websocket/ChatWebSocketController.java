package com.example.messaging.websocket;

import com.example.messaging.dto.chat.MessageRequest;
import com.example.messaging.dto.chat.MessageReactionRequest;
import com.example.messaging.dto.chat.MessageResponse;
import com.example.messaging.dto.chat.SeenRequest;
import com.example.messaging.dto.chat.TypingEvent;
import com.example.messaging.entity.User;
import com.example.messaging.service.MessageService;
import com.example.messaging.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;

/**
 * Realtime chat 1-1 flow (plan section 6 & 7):
 *   client sends to /app/chat.send -> here we persist via MessageService -> broadcast the saved
 *   message to /topic/conversation/{conversationId} so every open client in that conversation
 *   (including the sender's other tabs) receives it instantly, whether the recipient is online or not
 *   -- if offline, it's already safely in SQL Server and will be fetched via REST history on reconnect.
 */
@Controller
@RequiredArgsConstructor
public class ChatWebSocketController {

    private final MessageService messageService;
    private final UserService userService;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/chat.send")
    public void sendMessage(MessageRequest request, Principal principal) {
        User sender = userService.getByUsernameOrThrow(principal.getName());
        MessageResponse saved = messageService.sendMessage(sender.getUserId(), request);

        messagingTemplate.convertAndSend(
                "/topic/conversation/" + request.getConversationId(),
                saved);
    }

    @MessageMapping("/chat.react")
    public void reactToMessage(MessageReactionRequest request, Principal principal) {
        User user = userService.getByUsernameOrThrow(principal.getName());
        messagingTemplate.convertAndSend(
                "/topic/conversation/" + request.getConversationId() + "/reactions",
                messageService.toggleReaction(user.getUserId(), request));
    }

    @MessageMapping("/chat.seen")
    public void markSeen(SeenRequest request, Principal principal) {
        User user = userService.getByUsernameOrThrow(principal.getName());
        messageService.markConversationSeen(request.getConversationId(), user.getUserId());

        // Notify the conversation that this user has now seen messages, so the sender's UI
        // can flip Sent -> Seen in realtime.
        messagingTemplate.convertAndSend(
                "/topic/conversation/" + request.getConversationId() + "/seen",
                java.util.Map.of("userId", user.getUserId(), "conversationId", request.getConversationId()));
    }

    @MessageMapping("/chat.typing")
    public void typing(TypingEvent event, Principal principal) {
        User user = userService.getByUsernameOrThrow(principal.getName());
        event.setUserId(user.getUserId());
        event.setUsername(user.getUsername());

        messagingTemplate.convertAndSend(
                "/topic/conversation/" + event.getConversationId() + "/typing",
                event);
    }

    @MessageMapping("/chat.edit")
    public void editMessage(java.util.Map<String, Object> payload, Principal principal) {
        User user = userService.getByUsernameOrThrow(principal.getName());
        Long messageId = Long.valueOf(String.valueOf(payload.get("messageId")));
        Long conversationId = Long.valueOf(String.valueOf(payload.get("conversationId")));
        String content = String.valueOf(payload.getOrDefault("content", ""));

        MessageResponse edited = messageService.editMessage(messageId, user.getUserId(), content);
        messagingTemplate.convertAndSend(
                "/topic/conversation/" + conversationId,
                edited);
    }

    @MessageMapping("/chat.recall")
    public void recall(java.util.Map<String, Long> payload, Principal principal) {
        User user = userService.getByUsernameOrThrow(principal.getName());
        Long messageId = payload.get("messageId");
        Long conversationId = payload.get("conversationId");

        MessageResponse recalled = messageService.recall(messageId, user.getUserId());

        messagingTemplate.convertAndSend(
                "/topic/conversation/" + conversationId,
                recalled);
    }

    @MessageMapping("/call.signal")
    public void callSignal(java.util.Map<String, Object> payload, Principal principal) {
        String targetUsername = String.valueOf(payload.get("toUsername"));
        if (targetUsername.isBlank() || "null".equals(targetUsername)) return;

        payload.put("fromUsername", principal.getName());
        messagingTemplate.convertAndSendToUser(targetUsername, "/queue/call", payload);
    }
}
