package com.example.messaging.repository;

import com.example.messaging.entity.SocialGroup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SocialGroupRepository extends JpaRepository<SocialGroup, Long> {
    List<SocialGroup> findTop50ByNameContainingIgnoreCaseOrderByCreatedAtDesc(String name);
    List<SocialGroup> findTop50ByOrderByCreatedAtDesc();
}