package com.example.messaging.repository;

import com.example.messaging.entity.SocialStoryComment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SocialStoryCommentRepository extends JpaRepository<SocialStoryComment, Long> {

    List<SocialStoryComment> findByStory_StoryIdOrderByCreatedAtAsc(Long storyId);

    void deleteByStory_StoryId(Long storyId);
}
