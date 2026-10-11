package com.example.messaging.repository;

import com.example.messaging.entity.FriendRequest;
import com.example.messaging.entity.enums.FriendRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FriendRequestRepository extends JpaRepository<FriendRequest, Long> {

    List<FriendRequest> findByReceiverUserIdAndStatus(Long receiverId, FriendRequestStatus status);

    List<FriendRequest> findBySenderUserIdAndStatus(Long senderId, FriendRequestStatus status);

    List<FriendRequest> findBySenderUserIdAndStatusOrReceiverUserIdAndStatus(
            Long senderId, FriendRequestStatus senderStatus,
            Long receiverId, FriendRequestStatus receiverStatus);

    Optional<FriendRequest> findBySenderUserIdAndReceiverUserIdAndStatus(
            Long senderId, Long receiverId, FriendRequestStatus status);

    boolean existsBySenderUserIdAndReceiverUserIdAndStatus(
            Long senderId, Long receiverId, FriendRequestStatus status);

    @Query("SELECT f FROM FriendRequest f WHERE " +
            "(f.sender.userId = :userA AND f.receiver.userId = :userB) OR " +
            "(f.sender.userId = :userB AND f.receiver.userId = :userA) " +
            "ORDER BY f.createdAt DESC")
    List<FriendRequest> findRelationship(@Param("userA") Long userA, @Param("userB") Long userB);

        @Query("SELECT CASE WHEN COUNT(f) > 0 THEN true ELSE false END FROM FriendRequest f WHERE " +
                        "f.status = com.example.messaging.entity.enums.FriendRequestStatus.ACCEPTED AND " +
                        "((f.sender.userId = :userA AND f.receiver.userId = :userB) OR " +
                        "(f.sender.userId = :userB AND f.receiver.userId = :userA))")
        boolean areAcceptedFriends(@Param("userA") Long userA, @Param("userB") Long userB);
}
