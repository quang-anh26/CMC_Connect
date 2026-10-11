package com.example.messaging.entity;

import com.example.messaging.entity.enums.ConversationType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "CONVERSATION")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Conversation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "conversation_id")
    private Long conversationId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ConversationType type; // PRIVATE or GROUP

    @Column(length = 100)
    private String name; // used for GROUP only

    @Column(length = 500)
    private String avatar; // used for GROUP only

    @Column(length = 50)
    private String nickname;

    @Column(length = 255)
    private String topic;

    @OneToMany(mappedBy = "conversation", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ConversationMember> members = new ArrayList<>();

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "message_request_accepted", nullable = false)
    @Builder.Default
    private boolean messageRequestAccepted = false;

    @Column(name = "message_request_sender_id")
    private Long messageRequestSenderId;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
