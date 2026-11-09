package com.example.messaging.forum.repository;
import com.example.messaging.forum.entity.ForumCourse; import org.springframework.data.jpa.repository.JpaRepository;
public interface ForumCourseRepository extends JpaRepository<ForumCourse,Long> { java.util.List<ForumCourse> findByActiveTrueOrderByNameAsc(); }
