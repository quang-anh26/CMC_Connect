package com.example.messaging.repository;

import com.example.messaging.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    boolean existsByUsername(String username);

    /** Một email có thể gắn với nhiều tài khoản. */
    List<User> findAllByEmail(String email);

    boolean existsByEmail(String email);

    @Query("SELECT u FROM User u WHERE " +
           "LOWER(u.username) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(u.displayName) LIKE LOWER(CONCAT('%', :keyword, '%'))")
    List<User> searchByUsernameOrDisplayName(@Param("keyword") String keyword);

    long countByStatus(com.example.messaging.entity.enums.UserStatus status);

    long countByOnlineTrue();
}
