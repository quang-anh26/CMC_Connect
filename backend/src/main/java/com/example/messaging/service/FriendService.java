package com.example.messaging.service;

import com.example.messaging.dto.friend.FriendRequestResponse;
import com.example.messaging.entity.FriendRequest;
import com.example.messaging.entity.User;
import com.example.messaging.entity.enums.FriendRequestStatus;
import com.example.messaging.exception.ApiException;
import com.example.messaging.service.ConversationService;
import com.example.messaging.repository.FriendRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Friend request flow from plan section 3 (User) and section 7 (business flow):
 * find user -> send friend request -> receiver accepts -> can start chatting.
 */
@Service
@RequiredArgsConstructor
public class FriendService {

    private final FriendRequestRepository friendRequestRepository;
    private final UserService userService;
    private final ConversationService conversationService;
    private final NotificationService notificationService;
    private final ApplicationEventPublisher eventPublisher;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public FriendRequestResponse sendRequest(Long senderId, Long receiverId) {
        if (senderId.equals(receiverId)) {
            throw ApiException.badRequest("Không thể tự gửi lời mời kết bạn cho chính mình");
        }
        User sender = userService.getByIdOrThrow(senderId);
        User receiver = userService.getByIdOrThrow(receiverId);

        if (friendRequestRepository.areAcceptedFriends(senderId, receiverId)) {
            throw ApiException.conflict("Hai bạn đã là bạn bè");
        }
        if (friendRequestRepository.existsBySenderUserIdAndReceiverUserIdAndStatusOrSenderUserIdAndReceiverUserIdAndStatus(
                senderId, receiverId, FriendRequestStatus.PENDING,
                receiverId, senderId, FriendRequestStatus.PENDING)) {
            throw ApiException.conflict("Lời mời kết bạn đã được gửi trước đó");
        }

        FriendRequest fr = FriendRequest.builder()
                .sender(sender)
                .receiver(receiver)
                .status(FriendRequestStatus.PENDING)
                .build();

        FriendRequest saved = friendRequestRepository.save(fr);
        FriendRequestResponse response = toResponse(saved);
        eventPublisher.publishEvent(new FriendRequestCreated(receiver.getUsername(), response));
        return response;
    }

    @Transactional
    public void cancelRequest(Long requestId, Long senderId) {
        FriendRequest request = friendRequestRepository
                .findByIdAndSenderUserIdAndStatus(requestId, senderId, FriendRequestStatus.PENDING)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy lời mời đang chờ hoặc bạn không có quyền hủy"));
        friendRequestRepository.delete(request);
    }

    @Transactional
    public void removeFriend(Long userId, Long friendId) {
        if (userId.equals(friendId)) {
            throw ApiException.badRequest("Không thể hủy kết bạn với chính mình");
        }
        List<FriendRequest> acceptedRelationships = friendRequestRepository.findRelationship(userId, friendId)
                .stream()
                .filter(request -> request.getStatus() == FriendRequestStatus.ACCEPTED)
                .toList();
        if (acceptedRelationships.isEmpty()) {
            throw ApiException.notFound("Hai tài khoản hiện không phải là bạn bè");
        }
        friendRequestRepository.deleteAll(acceptedRelationships);
    }

    @Transactional
    public FriendRequestResponse respond(Long requestId, Long receiverId, boolean accept) {
        FriendRequest fr = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy lời mời kết bạn"));

        if (!fr.getReceiver().getUserId().equals(receiverId)) {
            throw ApiException.forbidden("Bạn không có quyền phản hồi lời mời này");
        }
        if (fr.getStatus() != FriendRequestStatus.PENDING) {
            throw ApiException.badRequest("Lời mời này đã được xử lý");
        }

        fr.setStatus(accept ? FriendRequestStatus.ACCEPTED : FriendRequestStatus.REJECTED);
        FriendRequest saved = friendRequestRepository.save(fr);
        if (accept) {
            conversationService.getOrCreatePrivateConversation(
                fr.getSender().getUserId(), fr.getReceiver().getUserId());
            notificationService.create(fr.getSender().getUserId(), fr.getReceiver().getUserId(),
                    "FRIEND_REQUEST_ACCEPTED", "USER", fr.getReceiver().getUserId(),
                    "đã chấp nhận lời mời kết bạn của bạn.");
        }
        return toResponse(saved);
    }

    public List<FriendRequestResponse> getPendingReceived(Long userId) {
        return friendRequestRepository.findByReceiverUserIdAndStatus(userId, FriendRequestStatus.PENDING)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    public List<FriendRequestResponse> getPendingSent(Long userId) {
        return friendRequestRepository.findBySenderUserIdAndStatus(userId, FriendRequestStatus.PENDING)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

        public List<FriendRequestResponse> getAccepted(Long userId) {
        return friendRequestRepository
            .findBySenderUserIdAndStatusOrReceiverUserIdAndStatus(
                userId, FriendRequestStatus.ACCEPTED,
                userId, FriendRequestStatus.ACCEPTED)
            .stream().map(this::toResponse).collect(Collectors.toList());
        }

    private FriendRequestResponse toResponse(FriendRequest fr) {
        return FriendRequestResponse.builder()
                .id(fr.getId())
                .senderId(fr.getSender().getUserId())
                .senderUsername(fr.getSender().getUsername())
                .senderDisplayName(fr.getSender().getDisplayName())
                .senderAvatar(fr.getSender().getAvatar())
                .receiverId(fr.getReceiver().getUserId())
                .receiverUsername(fr.getReceiver().getUsername())
                .receiverDisplayName(fr.getReceiver().getDisplayName())
                .receiverAvatar(fr.getReceiver().getAvatar())
                .status(fr.getStatus().name())
                .createdAt(fr.getCreatedAt())
                .build();
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void notifyRecipient(FriendRequestCreated event) {
        messagingTemplate.convertAndSendToUser(event.recipientUsername(), "/queue/notifications",
                Map.of("type", "FRIEND_REQUEST", "request", event.request()));
    }

    public record FriendRequestCreated(String recipientUsername, FriendRequestResponse request) {}
}
