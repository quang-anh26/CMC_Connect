package com.example.messaging.repository;

import com.example.messaging.entity.MessageReaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MessageReactionRepository extends JpaRepository<MessageReaction, Long> {

    List<MessageReaction> findByMessageMessageIdOrderByCreatedAtAsc(Long messageId);

    Optional<MessageReaction> findByMessageMessageIdAndUserUserId(Long messageId, Long userId);
}
