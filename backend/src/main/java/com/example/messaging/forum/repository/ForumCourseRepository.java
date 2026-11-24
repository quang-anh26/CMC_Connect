package com.example.messaging.forum.repository;

import com.example.messaging.forum.entity.ForumCourse;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ForumCourseRepository extends JpaRepository<ForumCourse, Long> {
    List<ForumCourse> findByActiveTrueOrderByNameAsc();

    Optional<ForumCourse> findFirstByNameIgnoreCase(String name);
}
