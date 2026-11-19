package com.example.messaging.repository;

import com.example.messaging.entity.ConversationMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ConversationMemberRepository extends JpaRepository<ConversationMember, Long> {

    List<ConversationMember> findByConversationConversationId(Long conversationId);

    Optional<ConversationMember> findByConversationConversationIdAndUserUserId(Long conversationId, Long userId);

    boolean existsByConversationConversationIdAndUserUserId(Long conversationId, Long userId);

    void deleteByConversationConversationIdAndUserUserId(Long conversationId, Long userId);

    /** Username của tất cả thành viên trong cuộc trò chuyện (dùng để chuyển tín hiệu gọi nhóm). */
    @Query("select m.user.username from ConversationMember m where m.conversation.conversationId = :conversationId")
    List<String> findUsernamesByConversationId(@Param("conversationId") Long conversationId);
}