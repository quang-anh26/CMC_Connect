package com.example.messaging.websocket;

import com.example.messaging.dto.chat.MessageRequest;
import com.example.messaging.dto.chat.MessageReactionRequest;
import com.example.messaging.dto.chat.MessageResponse;
import com.example.messaging.dto.chat.SeenRequest;
import com.example.messaging.dto.chat.TypingEvent;
import com.example.messaging.entity.User;
import com.example.messaging.exception.ApiException;
import com.example.messaging.repository.ConversationMemberRepository;
import com.example.messaging.service.MessageService;
import com.example.messaging.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * Realtime chat 1-1 flow (plan section 6 & 7):
 *   client sends to /app/chat.send -> here we persist via MessageService -> broadcast the saved
 *   message to /topic/conversation/{conversationId} so every open client in that conversation
 *   (including the sender's other tabs) receives it instantly, whether the recipient is online or not
 *   -- if offline, it's already safely in PostgreSQL and will be fetched via REST history on reconnect.
 */
@Controller
@RequiredArgsConstructor
public class ChatWebSocketController {

    private final MessageService messageService;
    private final UserService userService;
    private final SimpMessagingTemplate messagingTemplate;
    private final ConversationMemberRepository conversationMemberRepository;

    @MessageMapping("/chat.send")
    public void sendMessage(MessageRequest request, Principal principal) {
        User sender = userService.getByUsernameOrThrow(principal.getName());
        try {
            MessageResponse saved = messageService.sendMessage(sender.getUserId(), request);

            messagingTemplate.convertAndSend(
                    "/topic/conversation/" + request.getConversationId(),
                    saved);
        } catch (ApiException exception) {
            messagingTemplate.convertAndSendToUser(
                    principal.getName(),
                    "/queue/errors",
                    Map.of("message", exception.getMessage()));
        }
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

        User sender = userService.getByUsernameOrThrow(principal.getName());
        payload.put("fromUsername", principal.getName());
        payload.put("fromDisplayName", sender.getDisplayName());
        payload.put("fromAvatar", sender.getAvatar());
        messagingTemplate.convertAndSendToUser(targetUsername, "/queue/call", payload);
    }

    /**
     * Tín hiệu cuộc gọi NHÓM (WebRTC mesh). Chỉ thành viên của cuộc trò chuyện mới gửi được.
     *  - Có "toUsername": chuyển riêng cho người đó (offer / answer / candidate).
     *  - Không có "toUsername": gửi cho mọi thành viên khác (đổ chuông, tham gia, rời, kết thúc).
     */
    @MessageMapping("/call.group")
    public void groupCallSignal(Map<String, Object> payload, Principal principal) {
        Object rawId = payload.get("conversationId");
        if (!(rawId instanceof Number)) return;
        Long conversationId = ((Number) rawId).longValue();

        String me = principal.getName();
        List<String> members = conversationMemberRepository.findUsernamesByConversationId(conversationId);
        if (!members.contains(me)) return;

        User sender = userService.getByUsernameOrThrow(me);
        payload.put("fromUsername", me);
        payload.put("fromDisplayName", sender.getDisplayName());
        payload.put("fromAvatar", sender.getAvatar());
        payload.put("group", true);

        Object to = payload.get("toUsername");
        if (to instanceof String) {
            String target = (String) to;
            if (!target.isBlank() && !target.equals(me) && members.contains(target)) {
                messagingTemplate.convertAndSendToUser(target, "/queue/call", payload);
            }
            return;
        }
        for (String member : members) {
            if (!member.equals(me)) {
                messagingTemplate.convertAndSendToUser(member, "/queue/call", payload);
            }
        }
    }
}
