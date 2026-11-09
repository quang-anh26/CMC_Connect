package com.example.messaging.repository;

import com.example.messaging.entity.SocialStoryReaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SocialStoryReactionRepository extends JpaRepository<SocialStoryReaction, Long> {

    List<SocialStoryReaction> findByStory_StoryId(Long storyId);

    Optional<SocialStoryReaction> findByStory_StoryIdAndUser_UserId(Long storyId, Long userId);

    void deleteByStory_StoryId(Long storyId);
}
