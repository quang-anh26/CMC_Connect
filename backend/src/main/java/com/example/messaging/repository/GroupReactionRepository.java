package com.example.messaging.repository;

import com.example.messaging.entity.GroupReaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GroupReactionRepository extends JpaRepository<GroupReaction, Long> {
    Optional<GroupReaction> findByPostPostIdAndUserUserId(Long postId, Long userId);
    List<GroupReaction> findByPostPostId(Long postId);
    long countByPostPostId(Long postId);
}