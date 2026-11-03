package com.example.messaging.websocket;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * STOMP over WebSocket (plan section 2: "Spring WebSocket/STOMP") + section 6 realtime flow:
 * React -> WebSocket/STOMP -> Spring Boot -> save Message to PostgreSQL -> broadcast to recipient.
 *
 * Client connects to /ws (SockJS fallback enabled), subscribes to:
 *   /topic/conversation/{conversationId}   -> new messages / recall / seen updates in that conversation
 *   /topic/conversation/{conversationId}/typing -> typing indicator events
 *   /user/queue/notifications              -> personal notifications (new friend request, etc.)
 * and sends to:
 *   /app/chat.send      -> send a message
 *   /app/chat.seen      -> mark conversation as seen
 *   /app/chat.typing    -> typing indicator
 */
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    private final StompAuthChannelInterceptor stompAuthChannelInterceptor;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(stompAuthChannelInterceptor);
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
            .setAllowedOriginPatterns(allowedOrigins.split("\\s*,\\s*"))
            .withSockJS();
    }
}
