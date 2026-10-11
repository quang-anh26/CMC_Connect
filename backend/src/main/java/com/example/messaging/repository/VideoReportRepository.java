package com.example.messaging.repository;

import com.example.messaging.entity.VideoReport;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VideoReportRepository extends JpaRepository<VideoReport, Long> {
    boolean existsByPostPostIdAndReporterUserId(Long postId, Long reporterId);
    void deleteByPostPostId(Long postId);
}