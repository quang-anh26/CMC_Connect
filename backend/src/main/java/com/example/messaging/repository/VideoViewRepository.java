package com.example.messaging.repository;

import com.example.messaging.entity.VideoView;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface VideoViewRepository extends JpaRepository<VideoView, Long> {
    boolean existsByPostPostIdAndViewerUserIdAndViewedOn(Long postId, Long viewerId, LocalDate viewedOn);
    void deleteByPostPostId(Long postId);
}