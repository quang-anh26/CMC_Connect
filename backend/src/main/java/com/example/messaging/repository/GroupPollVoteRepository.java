package com.example.messaging.repository;

import com.example.messaging.entity.GroupPollVote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GroupPollVoteRepository extends JpaRepository<GroupPollVote, Long> {
    Optional<GroupPollVote> findByPollIdAndUserUserId(Long pollId, Long userId);
    long countByOptionId(Long optionId);
    void deleteByPollId(Long pollId);
}