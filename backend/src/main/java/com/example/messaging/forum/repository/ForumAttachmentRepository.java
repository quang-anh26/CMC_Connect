package com.example.messaging.forum.repository;

import com.example.messaging.forum.entity.ForumAttachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ForumAttachmentRepository extends JpaRepository<ForumAttachment, Long> {
    List<ForumAttachment> findByTopicIdOrderByCreatedAtAsc(Long topicId);

    boolean existsByTopicId(Long topicId);
}
