package com.example.messaging.service;

import com.example.messaging.dto.friend.FriendRequestResponse;
import com.example.messaging.entity.FriendRequest;
import com.example.messaging.entity.User;
import com.example.messaging.entity.enums.FriendRequestStatus;
import com.example.messaging.exception.ApiException;
import com.example.messaging.service.ConversationService;
import com.example.messaging.repository.FriendRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
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

    @Transactional
    public FriendRequestResponse sendRequest(Long senderId, Long receiverId) {
        if (senderId.equals(receiverId)) {
            throw ApiException.badRequest("Không thể tự gửi lời mời kết bạn cho chính mình");
        }
        User sender = userService.getByIdOrThrow(senderId);
        User receiver = userService.getByIdOrThrow(receiverId);

        if (friendRequestRepository.existsBySenderUserIdAndReceiverUserIdAndStatus(
                senderId, receiverId, FriendRequestStatus.PENDING)) {
            throw ApiException.conflict("Lời mời kết bạn đã được gửi trước đó");
        }

        FriendRequest fr = FriendRequest.builder()
                .sender(sender)
                .receiver(receiver)
                .status(FriendRequestStatus.PENDING)
                .build();

        return toResponse(friendRequestRepository.save(fr));
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
}
