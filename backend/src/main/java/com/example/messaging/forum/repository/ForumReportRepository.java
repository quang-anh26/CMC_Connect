package com.example.messaging.forum.repository;
import com.example.messaging.forum.entity.ForumReport; import org.springframework.data.jpa.repository.JpaRepository;
public interface ForumReportRepository extends JpaRepository<ForumReport,Long> { java.util.List<ForumReport> findByStatusOrderByCreatedAtAsc(String status); }
