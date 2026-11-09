package com.example.messaging.forum.repository;
import com.example.messaging.forum.entity.ForumBookmark; import org.springframework.data.jpa.repository.JpaRepository;
public interface ForumBookmarkRepository extends JpaRepository<ForumBookmark,Long> { boolean existsByUserUserIdAndTopicId(Long userId,Long topicId); java.util.Optional<ForumBookmark> findByUserUserIdAndTopicId(Long userId,Long topicId); java.util.List<ForumBookmark> findByUserUserIdOrderByCreatedAtDesc(Long userId); }
