package com.example.messaging.forum.repository;
import com.example.messaging.forum.entity.ForumCategory; import org.springframework.data.jpa.repository.JpaRepository;
public interface ForumCategoryRepository extends JpaRepository<ForumCategory,Long> { java.util.List<ForumCategory> findByActiveTrueOrderByNameAsc(); boolean existsByNameIgnoreCase(String name); }
