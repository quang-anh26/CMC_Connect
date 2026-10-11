package com.example.messaging.repository;

import com.example.messaging.entity.GroupReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GroupReportRepository extends JpaRepository<GroupReport, Long> {
    List<GroupReport> findByGroupGroupIdAndStatusOrderByCreatedAtDesc(Long groupId, String status);
}