package com.example.messaging.forum.repository;

import com.example.messaging.forum.entity.ForumFaculty;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ForumFacultyRepository extends JpaRepository<ForumFaculty, Long> {
    List<ForumFaculty> findByActiveTrueOrderByNameAsc();

    Optional<ForumFaculty> findByNameIgnoreCase(String name);
}
