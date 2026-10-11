package com.example.messaging.repository;

import com.example.messaging.entity.VideoFollow;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface VideoFollowRepository extends JpaRepository<VideoFollow, Long> {
    Optional<VideoFollow> findByFollowerUserIdAndCreatorUserId(Long followerId, Long creatorId);
    boolean existsByFollowerUserIdAndCreatorUserId(Long followerId, Long creatorId);
    long countByCreatorUserId(Long creatorId);
}