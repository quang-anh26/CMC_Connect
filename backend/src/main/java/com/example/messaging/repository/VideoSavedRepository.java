package com.example.messaging.repository;

import com.example.messaging.entity.VideoSaved;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface VideoSavedRepository extends JpaRepository<VideoSaved, Long> {
    Optional<VideoSaved> findByPostPostIdAndUserUserId(Long postId, Long userId);
    List<VideoSaved> findByUserUserIdOrderByCreatedAtDesc(Long userId);
    boolean existsByPostPostIdAndUserUserId(Long postId, Long userId);
    void deleteByPostPostId(Long postId);
}