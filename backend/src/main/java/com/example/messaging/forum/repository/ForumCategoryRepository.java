package com.example.messaging.forum.repository;

import com.example.messaging.forum.entity.ForumCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ForumCategoryRepository extends JpaRepository<ForumCategory, Long> {
    List<ForumCategory> findByActiveTrueOrderByNameAsc();

    Optional<ForumCategory> findByNameIgnoreCase(String name);
}
