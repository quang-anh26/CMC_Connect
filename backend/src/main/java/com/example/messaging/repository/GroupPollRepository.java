package com.example.messaging.repository;

import com.example.messaging.entity.GroupPoll;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GroupPollRepository extends JpaRepository<GroupPoll, Long> {
    Optional<GroupPoll> findByPostPostId(Long postId);
}