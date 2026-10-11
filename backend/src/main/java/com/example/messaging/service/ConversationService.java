package com.example.messaging.service;

import com.example.messaging.dto.chat.ConversationResponse;
import com.example.messaging.dto.chat.CreateGroupRequest;
import com.example.messaging.dto.chat.UpdateConversationDetailsRequest;
import com.example.messaging.entity.Conversation;
import com.example.messaging.entity.ConversationMember;
import com.example.messaging.entity.Message;
import com.example.messaging.entity.User;
import com.example.messaging.entity.enums.ConversationType;
import com.example.messaging.entity.enums.FriendRequestStatus;
import com.example.messaging.entity.enums.MemberRole;
import com.example.messaging.entity.enums.MessageDeliveryStatus;
import com.example.messaging.exception.ApiException;
import com.example.messaging.repository.ConversationMemberRepository;
import com.example.messaging.repository.ConversationRepository;
import com.example.messaging.repository.FriendRequestRepository;
import com.example.messaging.repository.MessageRepository;
import com.example.messaging.repository.MessageStatusRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final ConversationMemberRepository memberRepository;
    private final MessageRepository messageRepository;
    private final MessageStatusRepository messageStatusRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final UserService userService;

    /**
     * Chat 1-1: reuse existing PRIVATE conversation between the two users if one exists,
     * otherwise create it (plan section 7, step 2: "có thể bắt đầu chat" after friend request accepted).
     */
    @Transactional
    public Conversation getOrCreatePrivateConversation(Long userAId, Long userBId) {
        Optional<Conversation> existing = conversationRepository
                .findPrivateConversationBetween(ConversationType.PRIVATE, userAId, userBId);
        if (existing.isPresent()) {
            Conversation conversation = existing.get();
            boolean areFriends = friendRequestRepository.findRelationship(userAId, userBId).stream()
                    .anyMatch(request -> request.getStatus() == FriendRequestStatus.ACCEPTED);
            if (areFriends && !conversation.isMessageRequestAccepted()) {
                conversation.setMessageRequestAccepted(true);
                conversation.getMembers().forEach(member -> member.setMessageRequestPending(false));
                conversationRepository.save(conversation);
                memberRepository.saveAll(conversation.getMembers());
            }
            return conversation;
        }

        User userA = userService.getByIdOrThrow(userAId);
        User userB = userService.getByIdOrThrow(userBId);

        Conversation conversation = Conversation.builder()
                .type(ConversationType.PRIVATE)
                .build();
        conversation.setMessageRequestAccepted(friendRequestRepository.findRelationship(userAId, userBId).stream()
            .anyMatch(request -> request.getStatus() == FriendRequestStatus.ACCEPTED));
        conversation = conversationRepository.save(conversation);

        ConversationMember creatorMember = ConversationMember.builder()
            .conversation(conversation).user(userA).role(MemberRole.MEMBER).build();
        ConversationMember otherMember = ConversationMember.builder()
            .conversation(conversation).user(userB).role(MemberRole.MEMBER).build();
        memberRepository.save(creatorMember);
        memberRepository.save(otherMember);

        return conversation;
    }

    @Transactional
    public Conversation createGroup(Long creatorId, CreateGroupRequest request) {
        User creator = userService.getByIdOrThrow(creatorId);

        Conversation conversation = Conversation.builder()
                .type(ConversationType.GROUP)
                .name(request.getName())
                .avatar(request.getAvatar())
                .build();
        conversation = conversationRepository.save(conversation);

        memberRepository.save(ConversationMember.builder()
                .conversation(conversation).user(creator).role(MemberRole.ADMIN).build());

        for (Long memberId : request.getMemberIds()) {
            if (memberId.equals(creatorId)) continue;
            User member = userService.getByIdOrThrow(memberId);
            memberRepository.save(ConversationMember.builder()
                    .conversation(conversation).user(member).role(MemberRole.MEMBER).build());
        }

        return conversation;
    }

    @Transactional
    public void addMember(Long conversationId, Long requesterId, Long newMemberId) {
        requireGroupAdmin(conversationId, requesterId);
        Conversation conversation = getByIdOrThrow(conversationId);
        User newMember = userService.getByIdOrThrow(newMemberId);

        if (memberRepository.existsByConversationConversationIdAndUserUserId(conversationId, newMemberId)) {
            throw ApiException.conflict("Người dùng đã ở trong nhóm");
        }

        memberRepository.save(ConversationMember.builder()
                .conversation(conversation).user(newMember).role(MemberRole.MEMBER).build());
    }

    @Transactional
    public void removeMember(Long conversationId, Long requesterId, Long memberIdToRemove) {
        requireGroupAdmin(conversationId, requesterId);
        memberRepository.deleteByConversationConversationIdAndUserUserId(conversationId, memberIdToRemove);
    }

    @Transactional
    public void leaveGroup(Long conversationId, Long userId) {
        memberRepository.deleteByConversationConversationIdAndUserUserId(conversationId, userId);
    }

    private void requireGroupAdmin(Long conversationId, Long userId) {
        ConversationMember member = memberRepository
                .findByConversationConversationIdAndUserUserId(conversationId, userId)
                .orElseThrow(() -> ApiException.forbidden("Bạn không phải thành viên nhóm này"));
        if (member.getRole() != MemberRole.ADMIN) {
            throw ApiException.forbidden("Chỉ Admin nhóm mới có quyền này");
        }
    }

    public Conversation getByIdOrThrow(Long conversationId) {
        return conversationRepository.findById(conversationId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy cuộc trò chuyện"));
    }

    public void assertMember(Long conversationId, Long userId) {
        if (!memberRepository.existsByConversationConversationIdAndUserUserId(conversationId, userId)) {
            throw ApiException.forbidden("Bạn không thuộc cuộc trò chuyện này");
        }
    }

    /** List all conversations for the sidebar, newest activity first, with unread badge. */
    public List<ConversationResponse> listForUser(Long userId) {
        return conversationRepository.findActiveByMemberUserId(userId).stream()
                .map(c -> toResponse(c, userId))
                .filter(response -> !response.isMessageRequestPending())
                .sorted((a, b) -> {
                    if (a.isNewFriend() != b.isNewFriend()) return a.isNewFriend() ? -1 : 1;
                    if (a.getLastMessageAt() == null) return b.getLastMessageAt() == null ? 0 : 1;
                    if (b.getLastMessageAt() == null) return -1;
                    return b.getLastMessageAt().compareTo(a.getLastMessageAt());
                })
                .collect(Collectors.toList());
    }

    public List<ConversationResponse> listMessageRequestsForUser(Long userId) {
        return conversationRepository.findActiveByMemberUserId(userId).stream()
                .map(c -> toResponse(c, userId))
            .filter(response -> response.isMessageRequestPending() && response.getLastMessageAt() != null)
                .sorted((a, b) -> {
                    if (a.getLastMessageAt() == null) return b.getLastMessageAt() == null ? 0 : 1;
                    if (b.getLastMessageAt() == null) return -1;
                    return b.getLastMessageAt().compareTo(a.getLastMessageAt());
                })
                .collect(Collectors.toList());
    }

    public List<ConversationResponse> listArchivedForUser(Long userId) {
        return conversationRepository.findArchivedByMemberUserId(userId).stream()
                .map(c -> toResponse(c, userId))
                .sorted((a, b) -> {
                    if (a.getLastMessageAt() == null) return 1;
                    if (b.getLastMessageAt() == null) return -1;
                    return b.getLastMessageAt().compareTo(a.getLastMessageAt());
                })
                .collect(Collectors.toList());
    }

    @Transactional
    public void setArchived(Long conversationId, Long userId, boolean archived) {
        ConversationMember member = memberRepository
                .findByConversationConversationIdAndUserUserId(conversationId, userId)
                .orElseThrow(() -> ApiException.forbidden("Bạn không thuộc cuộc trò chuyện này"));
        member.setArchived(archived);
        memberRepository.save(member);
    }

    @Transactional
    public ConversationResponse updateDetails(Long conversationId, Long userId,
                                               UpdateConversationDetailsRequest request) {
        assertMember(conversationId, userId);
        Conversation conversation = getByIdOrThrow(conversationId);
        if (request.getNickname() != null) {
            if (conversation.getType() != ConversationType.PRIVATE) {
                throw ApiException.badRequest("Chỉ có thể đổi biệt danh trong trò chuyện cá nhân");
            }
            Long targetUserId = request.getTargetUserId() == null ? userId : request.getTargetUserId();
            ConversationMember target = memberRepository
                    .findByConversationConversationIdAndUserUserId(conversationId, targetUserId)
                    .orElseThrow(() -> ApiException.badRequest("Người được đổi biệt danh không thuộc cuộc trò chuyện"));
            target.setNickname(normalizeDetail(request.getNickname()));
            memberRepository.save(target);
        } else {
            assertMember(conversationId, userId);
        }

        if (request.getTopic() != null) {
            assertMember(conversationId, userId);
            conversation.setTopic(normalizeDetail(request.getTopic()));
        }
        conversationRepository.save(conversation);
        return toResponse(conversation, userId);
    }

    private String normalizeDetail(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }

    private ConversationResponse toResponse(Conversation conversation, Long viewerUserId) {
        String name = conversation.getName();
        String avatar = conversation.getAvatar();
        Long otherUserId = null;
        String otherUsername = null;
        String otherDisplayName = null;
        String otherNickname = null;
        boolean otherOnline = false;
        java.time.LocalDateTime otherLastSeenAt = null;
        ConversationMember currentMember = conversation.getMembers().stream()
            .filter(m -> m.getUser().getUserId().equals(viewerUserId))
            .findFirst()
            .orElse(null);

        if (conversation.getType() == ConversationType.PRIVATE) {
            Optional<ConversationMember> other = conversation.getMembers().stream()
                    .filter(m -> !m.getUser().getUserId().equals(viewerUserId))
                    .findFirst();
            if (other.isPresent()) {
                User otherUser = other.get().getUser();
                otherUserId = otherUser.getUserId();
                otherDisplayName = otherUser.getDisplayName();
                otherNickname = other.get().getNickname();
                name = otherNickname != null ? otherNickname
                    : conversation.getNickname() != null ? conversation.getNickname()
                    : otherUser.getDisplayName();
                avatar = otherUser.getAvatar();
                otherUsername = otherUser.getUsername();
                otherOnline = otherUser.isOnline();
                otherLastSeenAt = otherUser.getLastSeenAt();
            }
        }

        var lastPage = messageRepository.findByConversationConversationIdOrderByCreatedAtDesc(
                conversation.getConversationId(), PageRequest.of(0, 1, Sort.unsorted()));
        Message last = lastPage.hasContent() ? lastPage.getContent().get(0) : null;

        long unread = messageStatusRepository.countUnseenInConversationForUser(
                conversation.getConversationId(), viewerUserId);
        boolean newFriend = conversation.getType() == ConversationType.PRIVATE
            && last == null
            && otherUserId != null
            && (friendRequestRepository.existsBySenderUserIdAndReceiverUserIdAndStatus(
                viewerUserId, otherUserId, FriendRequestStatus.ACCEPTED)
                || friendRequestRepository.existsBySenderUserIdAndReceiverUserIdAndStatus(
                otherUserId, viewerUserId, FriendRequestStatus.ACCEPTED));

        return ConversationResponse.builder()
                .conversationId(conversation.getConversationId())
                .type(conversation.getType().name())
                .name(name)
                .avatar(avatar)
                .nickname(otherNickname != null ? otherNickname : conversation.getNickname())
                .topic(conversation.getTopic())
                .currentUserId(viewerUserId)
                .currentUserDisplayName(currentMember != null ? currentMember.getUser().getDisplayName() : null)
                .otherUserDisplayName(otherDisplayName)
                .currentUserNickname(currentMember != null ? currentMember.getNickname() : null)
                .otherUserNickname(otherNickname)
                .otherUserId(otherUserId)
                .otherUserUsername(otherUsername)
                .lastMessage(buildLastMessagePreview(last, viewerUserId))
                .lastMessageAt(last != null ? last.getCreatedAt() : null)
                .unreadCount(unread)
                .newFriend(newFriend)
                .messageRequestPending(currentMember != null && currentMember.isMessageRequestPending())
                .otherUserOnline(otherOnline)
                .otherUserLastSeenAt(otherLastSeenAt)
                .build();
    }

    private String buildLastMessagePreview(Message last, Long viewerUserId) {
        if (last == null) return null;
        if (last.isDeleted()) return "Tin nhắn đã được thu hồi";

        boolean looksLikeImageUrl = isImageUrl(last.getContent());
        boolean isImageMessage = last.getMessageType() == com.example.messaging.entity.enums.MessageType.IMAGE || looksLikeImageUrl;

        if (isImageMessage) {
            if (last.getSender().getUserId().equals(viewerUserId)) {
                return "Bạn đã gửi 1 ảnh";
            }

            String senderName = last.getSender().getDisplayName();
            if (senderName == null || senderName.isBlank()) {
                senderName = last.getSender().getUsername();
            }
            return senderName + " đã gửi 1 ảnh";
        }

        if (last.getMessageType() == com.example.messaging.entity.enums.MessageType.FILE) {
            return "Tệp đính kèm";
        }

        if (last.getMessageType() == com.example.messaging.entity.enums.MessageType.AUDIO) {
            return "Tin nhắn thoại";
        }

        return last.getContent();
    }

    private boolean isImageUrl(String content) {
        if (content == null || content.isBlank()) return false;
        String lower = content.toLowerCase();
        return lower.contains("/uploads/") || lower.contains(".png") || lower.contains(".jpg")
                || lower.contains(".jpeg") || lower.contains(".gif") || lower.contains(".webp");
    }
}
