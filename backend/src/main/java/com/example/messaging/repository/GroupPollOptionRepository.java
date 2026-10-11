package com.example.messaging.repository;

import com.example.messaging.entity.GroupPollOption;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GroupPollOptionRepository extends JpaRepository<GroupPollOption, Long> {
    List<GroupPollOption> findByPollIdOrderByIdAsc(Long pollId);
    Optional<GroupPollOption> findByIdAndPollId(Long optionId, Long pollId);
    void deleteByPollId(Long pollId);
}