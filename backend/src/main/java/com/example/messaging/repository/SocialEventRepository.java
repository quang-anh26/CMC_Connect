package com.example.messaging.repository;

import com.example.messaging.entity.SocialEvent;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface SocialEventRepository extends JpaRepository<SocialEvent, Long> {
    @EntityGraph(attributePaths = {"organizer", "participants", "participants.user"})
    List<SocialEvent> findByCancelledFalseOrderByStartsAtAsc();

    /** Sự kiện chưa bị hủy có giờ bắt đầu trong khoảng [from, to] — dùng cho job nhắc lịch. */
    @EntityGraph(attributePaths = {"organizer", "participants", "participants.user"})
    List<SocialEvent> findByCancelledFalseAndStartsAtBetween(LocalDateTime from, LocalDateTime to);
}
