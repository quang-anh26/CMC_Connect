package com.example.messaging.websocket;

import com.example.messaging.entity.User;
import com.example.messaging.service.UserService;
import com.example.messaging.service.PresenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import jakarta.annotation.PostConstruct;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tracks Online / Offline presence (plan section 3, User: "Theo dõi Online / Offline")
 * by hooking into the STOMP session lifecycle - connect = online, disconnect = offline.
 */
@Component
@RequiredArgsConstructor
public class PresenceEventListener {

    private final UserService userService;
    private final PresenceService presenceService;
    private final SimpMessagingTemplate messagingTemplate;
    private final Map<String, Set<String>> sessionsByUsername = new ConcurrentHashMap<>();

    @PostConstruct
    public void clearStalePresence() {
        userService.markAllOffline();
    }

    @EventListener
    public void handleConnect(SessionConnectedEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        if (accessor.getUser() != null) {
            String username = accessor.getUser().getName();
            String sessionId = accessor.getSessionId();
            Set<String> sessions = sessionsByUsername.computeIfAbsent(username, ignored -> ConcurrentHashMap.newKeySet());
            if (sessions.add(sessionId) && sessions.size() == 1) {
                withUser(username);
            }
        }
    }

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        if (accessor.getUser() != null) {
            String username = accessor.getUser().getName();
            Set<String> sessions = sessionsByUsername.get(username);
            if (sessions != null) {
                sessions.remove(accessor.getSessionId());
                if (sessions.isEmpty()) {
                    sessionsByUsername.remove(username, sessions);
                    withUser(username);
                }
            }
        }
    }

    private void withUser(String username) {
        try {
            User user = userService.getByUsernameOrThrow(username);
            messagingTemplate.convertAndSend("/topic/presence",
                    java.util.Map.of("userId", user.getUserId(), "online", presenceService.isOnline(user.getUserId())));
        } catch (Exception ignored) {
            // user not found / already handled - safe to ignore for presence tracking
        }
    }
}
