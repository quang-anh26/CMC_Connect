package com.example.messaging.forum.repository;
import com.example.messaging.forum.entity.ForumReply; import org.springframework.data.jpa.repository.JpaRepository;
public interface ForumReplyRepository extends JpaRepository<ForumReply,Long> { java.util.List<ForumReply> findByTopicIdOrderByCreatedAtAsc(Long topicId); long countByTopicId(Long topicId); }
