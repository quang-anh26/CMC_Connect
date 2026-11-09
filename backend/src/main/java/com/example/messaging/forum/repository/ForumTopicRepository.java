package com.example.messaging.forum.repository;

import com.example.messaging.forum.entity.ForumTopic;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface ForumTopicRepository extends JpaRepository<ForumTopic, Long>, JpaSpecificationExecutor<ForumTopic> {
    java.util.Optional<ForumTopic> findBySubmissionKey(String submissionKey);
}
