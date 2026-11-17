package com.example.messaging.repository;

import com.example.messaging.entity.HiddenPostAuthor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface HiddenPostAuthorRepository extends JpaRepository<HiddenPostAuthor, Long> {
    boolean existsByViewerUserIdAndAuthorUserId(Long viewerId, Long authorId);

    @Query("SELECT hidden.author.userId FROM HiddenPostAuthor hidden WHERE hidden.viewer.userId = :viewerId")
    List<Long> findHiddenAuthorIdsByViewerId(@Param("viewerId") Long viewerId);
}
