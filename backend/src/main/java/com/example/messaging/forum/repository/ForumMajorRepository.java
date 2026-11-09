package com.example.messaging.forum.repository;

import com.example.messaging.forum.entity.ForumMajor;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ForumMajorRepository extends JpaRepository<ForumMajor, Long> {
    List<ForumMajor> findByActiveTrueOrderByNameAsc();

    List<ForumMajor> findByFacultyIdAndActiveTrueOrderByNameAsc(Long facultyId);

    boolean existsByFacultyIdAndNameIgnoreCase(Long facultyId, String name);
}
