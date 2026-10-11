package com.example.messaging.service;

import com.example.messaging.dto.group.GroupRequests;
import com.example.messaging.entity.*;
import com.example.messaging.exception.ApiException;
import com.example.messaging.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
public class GroupService {
    private static final Set<String> VISIBILITIES = Set.of("PUBLIC", "PRIVATE");
    private static final Set<String> REACTIONS = Set.of("LIKE", "LOVE", "HAHA", "WOW", "ANGRY");
    private static final Set<String> ROLES = Set.of("ADMIN", "MODERATOR", "MEMBER");

    private final SocialGroupRepository groupRepository;
    private final GroupMemberRepository memberRepository;
    private final GroupJoinRequestRepository joinRequestRepository;
    private final GroupPostRepository postRepository;
    private final GroupCommentRepository commentRepository;
    private final GroupReactionRepository reactionRepository;
    private final GroupBanRepository banRepository;
    private final GroupReportRepository reportRepository;
    private final GroupNotificationRepository notificationRepository;
    private final GroupInviteRepository inviteRepository;
    private final GroupPollRepository pollRepository;
    private final GroupPollOptionRepository pollOptionRepository;
    private final GroupPollVoteRepository pollVoteRepository;
    private final GroupEventRepository eventRepository;
    private final GroupEventParticipantRepository eventParticipantRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final UserService userService;

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listGroups(Long userId, String search, boolean mine) {
        List<SocialGroup> groups;
        if (mine) {
            groups = memberRepository.findByUserUserIdOrderByJoinedAtDesc(userId).stream()
                    .map(GroupMember::getGroup).toList();
        } else {
            String query = search == null ? "" : search.trim();
            groups = query.isEmpty() ? groupRepository.findTop50ByOrderByCreatedAtDesc()
                    : groupRepository.findTop50ByNameContainingIgnoreCaseOrderByCreatedAtDesc(query);
            groups = groups.stream().filter(group -> "PUBLIC".equals(group.getVisibility())
                    || memberRepository.existsByGroupGroupIdAndUserUserId(group.getGroupId(), userId)).toList();
        }
        return groups.stream().map(group -> groupSummary(group, userId)).toList();
    }

    @Transactional
    public Map<String, Object> createGroup(Long ownerId, GroupRequests.CreateGroup request) {
        User owner = userService.getByIdOrThrow(ownerId);
        String visibility = normalizeVisibility(request.visibility());
        SocialGroup group = groupRepository.save(SocialGroup.builder()
                .owner(owner).name(request.name().trim()).description(clean(request.description()))
                .avatar(clean(request.avatar())).coverImage(clean(request.coverImage()))
                .category(clean(request.category())).visibility(visibility).build());
        memberRepository.save(GroupMember.builder().group(group).user(owner).role("OWNER").build());
        return groupSummary(group, ownerId);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getGroup(Long groupId, Long viewerId) {
        return groupSummary(requireReadableGroup(groupId, viewerId), viewerId);
    }

    @Transactional(readOnly = true)
    public void authorizeUpload(Long groupId, Long userId, boolean groupImage) {
        requireMember(groupId, userId);
        if (groupImage) requireModerator(groupId, userId);
    }

    @Transactional
    public Map<String, Object> updateGroup(Long groupId, Long requesterId, GroupRequests.UpdateGroup request) {
        SocialGroup group = getGroupOrThrow(groupId);
        requireModerator(groupId, requesterId);
        if (request.name() != null) {
            if (request.name().isBlank()) throw ApiException.badRequest("Tên nhóm không được để trống");
            group.setName(request.name().trim());
        }
        if (request.description() != null) group.setDescription(clean(request.description()));
        if (request.avatar() != null) group.setAvatar(clean(request.avatar()));
        if (request.coverImage() != null) group.setCoverImage(clean(request.coverImage()));
        if (request.category() != null) group.setCategory(clean(request.category()));
        if (request.visibility() != null) group.setVisibility(normalizeVisibility(request.visibility()));
        if (request.postApprovalRequired() != null) group.setPostApprovalRequired(request.postApprovalRequired());
        if (request.spamKeywords() != null) group.setSpamKeywords(clean(request.spamKeywords()));
        return groupSummary(groupRepository.save(group), requesterId);
    }

    @Transactional
    public void deleteGroup(Long groupId, Long requesterId) {
        SocialGroup group = getGroupOrThrow(groupId);
        if (!group.getOwner().getUserId().equals(requesterId)) throw ApiException.forbidden("Chỉ chủ nhóm mới được xóa nhóm");
        List<GroupPost> groupPosts = postRepository.findAll().stream()
            .filter(post -> post.getGroup().getGroupId().equals(groupId)).toList();
        for (GroupPost post : groupPosts) {
            deletePostChildren(post);
            postRepository.delete(post);
        }
        List<GroupEvent> groupEvents = eventRepository.findByGroupGroupIdOrderByStartsAtAsc(groupId);
        groupEvents.forEach(event -> eventParticipantRepository.deleteByEventId(event.getId()));
        eventRepository.deleteAll(groupEvents);
        memberRepository.deleteAll(memberRepository.findByGroupGroupIdOrderByJoinedAtAsc(groupId));
        joinRequestRepository.deleteAll(joinRequestRepository.findAll().stream()
                .filter(request -> request.getGroup().getGroupId().equals(groupId)).toList());
        banRepository.deleteAll(banRepository.findAll().stream().filter(ban -> ban.getGroup().getGroupId().equals(groupId)).toList());
        reportRepository.deleteAll(reportRepository.findAll().stream().filter(report -> report.getGroup().getGroupId().equals(groupId)).toList());
        notificationRepository.deleteAll(notificationRepository.findAll().stream()
                .filter(notification -> notification.getGroup().getGroupId().equals(groupId)).toList());
        inviteRepository.deleteAll(inviteRepository.findAll().stream()
                .filter(invite -> invite.getGroup().getGroupId().equals(groupId)).toList());
        groupRepository.delete(group);
    }

    @Transactional
    public Map<String, Object> joinGroup(Long groupId, Long userId) {
        SocialGroup group = getGroupOrThrow(groupId);
        if (banRepository.findByGroupGroupIdAndUserUserId(groupId, userId).isPresent()) {
            throw ApiException.forbidden("Bạn đã bị cấm khỏi nhóm này");
        }
        if (memberRepository.existsByGroupGroupIdAndUserUserId(groupId, userId)) {
            throw ApiException.conflict("Bạn đã là thành viên của nhóm");
        }
        if ("PUBLIC".equals(group.getVisibility())) {
            addMember(group, userService.getByIdOrThrow(userId), "MEMBER");
            notifyGroup(group, userId, "MEMBER_JOINED", userId, "Một thành viên mới đã tham gia nhóm");
            return Map.of("status", "JOINED", "group", groupSummary(group, userId));
        }
        Optional<GroupJoinRequest> existingRequest = joinRequestRepository.findByGroupGroupIdAndUserUserId(groupId, userId);
        if (existingRequest.isPresent() && "PENDING".equals(existingRequest.get().getStatus())) return Map.of("status", "PENDING");
        GroupJoinRequest request = existingRequest
            .orElseGet(() -> GroupJoinRequest.builder().group(group).user(userService.getByIdOrThrow(userId)).build());
        request.setStatus("PENDING");
        joinRequestRepository.save(request);
        notifyGroup(group, group.getOwner().getUserId(), "JOIN_REQUEST", userId, "Có yêu cầu tham gia nhóm mới");
        return Map.of("status", "PENDING");
    }

    @Transactional
    public void leaveGroup(Long groupId, Long userId) {
        GroupMember member = memberRepository.findByGroupGroupIdAndUserUserId(groupId, userId)
                .orElseThrow(() -> ApiException.badRequest("Bạn chưa tham gia nhóm"));
        if ("OWNER".equals(member.getRole())) throw ApiException.badRequest("Chủ nhóm cần chuyển quyền sở hữu trước khi rời nhóm");
        memberRepository.delete(member);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listMembers(Long groupId, Long viewerId) {
        requireReadableGroup(groupId, viewerId);
        return memberRepository.findByGroupGroupIdOrderByJoinedAtAsc(groupId).stream().map(this::memberResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listPosts(Long groupId, Long viewerId, String search, String sort, boolean mediaOnly) {
        requireReadableGroup(groupId, viewerId);
        GroupMember viewer = memberRepository.findByGroupGroupIdAndUserUserId(groupId, viewerId).orElse(null);
        boolean moderator = viewer != null && isModeratorRole(viewer.getRole());
        List<GroupPost> posts = postRepository.findByGroupGroupIdAndStatusOrderByPinnedDescCreatedAtDesc(groupId, "PUBLISHED");
        if (moderator) {
            List<GroupPost> visiblePosts = new ArrayList<>(posts);
            visiblePosts.addAll(postRepository.findByGroupGroupIdAndStatusOrderByPinnedDescCreatedAtDesc(groupId, "PENDING"));
            posts = visiblePosts;
        }
        String query = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        posts = posts.stream().filter(post -> query.isEmpty() || post.getContent().toLowerCase(Locale.ROOT).contains(query))
                .filter(post -> !mediaOnly || post.getMediaUrl() != null)
                .sorted(postComparator(sort)).toList();
        return posts.stream().map(post -> postResponse(post, viewerId)).toList();
    }

    @Transactional
    public Map<String, Object> createPost(Long groupId, Long authorId, GroupRequests.CreatePost request) {
        SocialGroup group = requireReadableGroup(groupId, authorId);
        requireMember(groupId, authorId);
        enforcePostRateLimit(groupId, authorId);
        String content = clean(request.content());
        String mediaUrl = clean(request.mediaUrl());
        String mediaType = request.mediaType() == null ? null : request.mediaType().trim().toUpperCase(Locale.ROOT);
        if ((content == null || content.isBlank()) && mediaUrl == null) throw ApiException.badRequest("Bài viết cần có nội dung hoặc tệp đính kèm");
        if (mediaUrl != null && !Set.of("IMAGE", "VIDEO", "FILE").contains(mediaType)) throw ApiException.badRequest("Loại tệp không hợp lệ");
        if (containsSpam(group, content)) throw ApiException.badRequest("Bài viết chứa từ khóa không được phép");
        boolean pending = group.isPostApprovalRequired();
        GroupPost post = postRepository.save(GroupPost.builder().group(group).author(userService.getByIdOrThrow(authorId))
                .content(content == null ? "" : content).mediaUrl(mediaUrl).mediaType(mediaType)
                .status(pending ? "PENDING" : "PUBLISHED").build());
        if (pending) notifyGroup(group, group.getOwner().getUserId(), "POST_REVIEW", post.getPostId(), "Bài viết đang chờ duyệt");
        return postResponse(post, authorId);
    }

    @Transactional
    public Map<String, Object> updatePost(Long groupId, Long postId, Long requesterId, GroupRequests.CreatePost request) {
        GroupPost post = getPostOrThrow(groupId, postId, requesterId);
        if (!post.getAuthor().getUserId().equals(requesterId)) throw ApiException.forbidden("Chỉ tác giả mới được sửa bài viết");
        String content = clean(request.content());
        String mediaUrl = clean(request.mediaUrl());
        if ((content == null || content.isBlank()) && mediaUrl == null) throw ApiException.badRequest("Bài viết cần có nội dung hoặc tệp đính kèm");
        if (containsSpam(post.getGroup(), content)) throw ApiException.badRequest("Bài viết chứa từ khóa không được phép");
        String mediaType = request.mediaType() == null ? post.getMediaType() : request.mediaType().trim().toUpperCase(Locale.ROOT);
        if (mediaUrl != null && !Set.of("IMAGE", "VIDEO", "FILE").contains(mediaType)) throw ApiException.badRequest("Loại tệp không hợp lệ");
        post.setContent(content == null ? "" : content);
        post.setMediaUrl(mediaUrl);
        post.setMediaType(mediaUrl == null ? null : mediaType);
        return postResponse(postRepository.save(post), requesterId);
    }

    @Transactional
    public void deletePost(Long groupId, Long postId, Long requesterId) {
        GroupPost post = getPostOrThrow(groupId, postId, requesterId);
        if (!post.getAuthor().getUserId().equals(requesterId)) requireModerator(groupId, requesterId);
        deletePostChildren(post);
        postRepository.delete(post);
    }

    @Transactional
    public Map<String, Object> createPoll(Long groupId, Long authorId, GroupRequests.CreatePoll request) {
        SocialGroup group = requireReadableGroup(groupId, authorId);
        requireMember(groupId, authorId);
        enforcePostRateLimit(groupId, authorId);
        String question = request.question().trim();
        if (containsSpam(group, question)) throw ApiException.badRequest("Câu hỏi chứa từ khóa không được phép");
        if (request.endsAt() != null && !request.endsAt().isAfter(java.time.LocalDateTime.now())) {
            throw ApiException.badRequest("Thời điểm kết thúc phải ở tương lai");
        }
        List<String> labels = request.options().stream().map(String::trim).filter(label -> !label.isBlank()).distinct().toList();
        if (labels.size() < 2) throw ApiException.badRequest("Cuộc bình chọn cần ít nhất hai lựa chọn khác nhau");
        GroupPost post = postRepository.save(GroupPost.builder().group(group).author(userService.getByIdOrThrow(authorId))
                .content(question).postType("POLL").status(group.isPostApprovalRequired() ? "PENDING" : "PUBLISHED").build());
        GroupPoll poll = pollRepository.save(GroupPoll.builder().post(post).endsAt(request.endsAt()).build());
        labels.forEach(label -> pollOptionRepository.save(GroupPollOption.builder().poll(poll).label(label).build()));
        if (group.isPostApprovalRequired()) notifyGroup(group, group.getOwner().getUserId(), "POST_REVIEW", post.getPostId(), "Bình chọn đang chờ duyệt");
        return postResponse(post, authorId);
    }

    @Transactional
    public Map<String, Object> votePoll(Long groupId, Long postId, Long userId, Long optionId) {
        GroupPost post = getPostOrThrow(groupId, postId, userId);
        requireMember(groupId, userId);
        if (!"PUBLISHED".equals(post.getStatus())) throw ApiException.conflict("Bài viết chưa được duyệt");
        GroupPoll poll = pollRepository.findByPostPostId(postId).orElseThrow(() -> ApiException.notFound("Không tìm thấy bình chọn"));
        if (poll.getEndsAt() != null && !poll.getEndsAt().isAfter(java.time.LocalDateTime.now())) throw ApiException.conflict("Bình chọn đã kết thúc");
        GroupPollOption option = pollOptionRepository.findByIdAndPollId(optionId, poll.getId())
                .orElseThrow(() -> ApiException.badRequest("Lựa chọn không thuộc bình chọn này"));
        GroupPollVote vote = pollVoteRepository.findByPollIdAndUserUserId(poll.getId(), userId)
                .orElseGet(() -> GroupPollVote.builder().poll(poll).user(userService.getByIdOrThrow(userId)).build());
        vote.setOption(option);
        pollVoteRepository.save(vote);
        return postResponse(post, userId);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listEvents(Long groupId, Long viewerId) {
        requireReadableGroup(groupId, viewerId);
        return eventRepository.findByGroupGroupIdOrderByStartsAtAsc(groupId).stream().map(event -> eventResponse(event, viewerId)).toList();
    }

    @Transactional
    public Map<String, Object> createEvent(Long groupId, Long creatorId, GroupRequests.CreateEvent request) {
        SocialGroup group = requireReadableGroup(groupId, creatorId);
        requireMember(groupId, creatorId);
        if (containsSpam(group, request.title() + " " + (request.description() == null ? "" : request.description()))) {
            throw ApiException.badRequest("Sự kiện chứa từ khóa không được phép");
        }
        if (request.endsAt() != null && !request.endsAt().isAfter(request.startsAt())) {
            throw ApiException.badRequest("Thời gian kết thúc phải sau thời gian bắt đầu");
        }
        GroupEvent event = eventRepository.save(GroupEvent.builder().group(group).createdBy(userService.getByIdOrThrow(creatorId))
                .title(request.title().trim()).description(clean(request.description())).location(clean(request.location()))
                .startsAt(request.startsAt()).endsAt(request.endsAt()).build());
        return eventResponse(event, creatorId);
    }

    @Transactional
    public Map<String, Object> toggleEventParticipation(Long groupId, Long eventId, Long userId) {
        requireMember(groupId, userId);
        GroupEvent event = eventRepository.findByIdAndGroupGroupId(eventId, groupId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy sự kiện"));
        Optional<GroupEventParticipant> participation = eventParticipantRepository.findByEventIdAndUserUserId(eventId, userId);
        if (participation.isPresent()) eventParticipantRepository.delete(participation.get());
        else eventParticipantRepository.save(GroupEventParticipant.builder().event(event).user(userService.getByIdOrThrow(userId)).build());
        return eventResponse(event, userId);
    }

    @Transactional
    public Map<String, Object> toggleReaction(Long groupId, Long postId, Long userId, String type) {
        GroupPost post = getPostOrThrow(groupId, postId, userId);
        requireMember(groupId, userId);
        String reactionType = type == null ? "LIKE" : type.trim().toUpperCase(Locale.ROOT);
        if (!REACTIONS.contains(reactionType)) throw ApiException.badRequest("Loại cảm xúc không hợp lệ");
        reactionRepository.findByPostPostIdAndUserUserId(postId, userId).ifPresentOrElse(existing -> {
            if (existing.getReactionType().equals(reactionType)) reactionRepository.delete(existing);
            else { existing.setReactionType(reactionType); reactionRepository.save(existing); }
        }, () -> reactionRepository.save(GroupReaction.builder().post(post).user(userService.getByIdOrThrow(userId)).reactionType(reactionType).build()));
        if (!post.getAuthor().getUserId().equals(userId)) notifyGroup(post.getGroup(), post.getAuthor().getUserId(), "REACTION", postId, "Có cảm xúc mới trên bài viết của bạn");
        return postResponse(post, userId);
    }

    @Transactional
    public Map<String, Object> addComment(Long groupId, Long postId, Long authorId, GroupRequests.CreateComment request) {
        GroupPost post = getPostOrThrow(groupId, postId, authorId);
        requireMember(groupId, authorId);
        if (commentRepository.countByPostGroupGroupIdAndAuthorUserIdAndCreatedAtAfter(groupId, authorId,
                java.time.LocalDateTime.now().minusMinutes(1)) >= 20) {
            throw ApiException.conflict("Bạn đang bình luận quá nhanh. Vui lòng thử lại sau.");
        }
        String content = request.content().trim();
        if (containsSpam(post.getGroup(), content)) throw ApiException.badRequest("Bình luận chứa từ khóa không được phép");
        GroupComment parent = request.parentCommentId() == null ? null : commentRepository.findById(request.parentCommentId())
                .filter(comment -> comment.getPost().getPostId().equals(postId))
                .orElseThrow(() -> ApiException.badRequest("Bình luận cha không hợp lệ"));
        if (parent != null && parent.getParentComment() != null) throw ApiException.badRequest("Chỉ hỗ trợ trả lời một cấp bình luận");
        GroupComment comment = commentRepository.save(GroupComment.builder().post(post).author(userService.getByIdOrThrow(authorId))
                .parentComment(parent).content(content).build());
        if (!post.getAuthor().getUserId().equals(authorId)) notifyGroup(post.getGroup(), post.getAuthor().getUserId(), "COMMENT", postId, "Có bình luận mới trên bài viết của bạn");
        return commentResponse(comment);
    }

    @Transactional
    public void deleteComment(Long groupId, Long commentId, Long requesterId) {
        GroupComment comment = commentRepository.findById(commentId).orElseThrow(() -> ApiException.notFound("Không tìm thấy bình luận"));
        if (!comment.getPost().getGroup().getGroupId().equals(groupId)) throw ApiException.notFound("Không tìm thấy bình luận");
        requireReadableGroup(groupId, requesterId);
        if (!comment.getAuthor().getUserId().equals(requesterId)) requireModerator(groupId, requesterId);
        commentRepository.deleteAll(commentRepository.findByParentCommentCommentId(commentId));
        commentRepository.delete(comment);
    }

    @Transactional
    public void togglePin(Long groupId, Long postId, Long requesterId) {
        requireModerator(groupId, requesterId);
        GroupPost post = getPostOrThrow(groupId, postId, requesterId);
        post.setPinned(!post.isPinned());
        postRepository.save(post);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> joinRequests(Long groupId, Long requesterId) {
        requireModerator(groupId, requesterId);
        return joinRequestRepository.findByGroupGroupIdAndStatusOrderByCreatedAtDesc(groupId, "PENDING").stream()
                .map(request -> Map.<String, Object>of("id", request.getId(), "userId", request.getUser().getUserId(),
                        "name", displayName(request.getUser()), "avatar", nullSafe(request.getUser().getAvatar()), "createdAt", request.getCreatedAt()))
                .toList();
    }

    @Transactional
    public void decideJoinRequest(Long groupId, Long requestId, Long requesterId, boolean approved) {
        requireModerator(groupId, requesterId);
        GroupJoinRequest request = joinRequestRepository.findById(requestId)
                .filter(item -> item.getGroup().getGroupId().equals(groupId) && "PENDING".equals(item.getStatus()))
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy yêu cầu tham gia"));
        if (approved && banRepository.findByGroupGroupIdAndUserUserId(groupId, request.getUser().getUserId()).isPresent()) {
            throw ApiException.conflict("Thành viên này đang bị cấm khỏi nhóm");
        }
        request.setStatus(approved ? "APPROVED" : "REJECTED");
        if (approved) addMember(request.getGroup(), request.getUser(), "MEMBER");
        notificationRepository.save(GroupNotification.builder().group(request.getGroup()).user(request.getUser())
                .actor(userService.getByIdOrThrow(requesterId)).type(approved ? "JOIN_APPROVED" : "JOIN_REJECTED")
                .message(approved ? "Yêu cầu tham gia nhóm đã được duyệt" : "Yêu cầu tham gia nhóm đã bị từ chối").build());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> pendingPosts(Long groupId, Long requesterId) {
        requireModerator(groupId, requesterId);
        return postRepository.findByGroupGroupIdAndStatusOrderByPinnedDescCreatedAtDesc(groupId, "PENDING").stream()
                .map(post -> postResponse(post, requesterId)).toList();
    }

    @Transactional
    public void decidePost(Long groupId, Long postId, Long requesterId, boolean approved) {
        requireModerator(groupId, requesterId);
        GroupPost post = postRepository.findByPostIdAndGroupGroupId(postId, groupId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy bài viết"));
        if (!"PENDING".equals(post.getStatus())) throw ApiException.conflict("Bài viết đã được xử lý");
        post.setStatus(approved ? "PUBLISHED" : "REJECTED");
        postRepository.save(post);
        notificationRepository.save(GroupNotification.builder().group(post.getGroup()).user(post.getAuthor())
                .actor(userService.getByIdOrThrow(requesterId)).type(approved ? "POST_APPROVED" : "POST_REJECTED")
                .referenceId(postId).message(approved ? "Bài viết của bạn đã được duyệt" : "Bài viết của bạn chưa được duyệt").build());
    }

    @Transactional
    public void changeRole(Long groupId, Long targetUserId, Long requesterId, String requestedRole) {
        GroupMember actor = requireModerator(groupId, requesterId);
        GroupMember target = memberRepository.findByGroupGroupIdAndUserUserId(groupId, targetUserId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy thành viên"));
        String role = requestedRole.trim().toUpperCase(Locale.ROOT);
        if (!ROLES.contains(role)) throw ApiException.badRequest("Vai trò không hợp lệ");
        if (roleRank(actor.getRole()) <= roleRank(target.getRole())) throw ApiException.forbidden("Bạn không thể thay đổi vai trò này");
        if (actor.getRole().equals("MODERATOR") && !"MEMBER".equals(role)) throw ApiException.forbidden("Moderator chỉ được giữ hoặc hạ thành viên về Member");
        if (actor.getRole().equals("ADMIN") && !Set.of("MEMBER", "MODERATOR").contains(role)) throw ApiException.forbidden("Admin chỉ được phân quyền Moderator hoặc Member");
        target.setRole(role);
        memberRepository.save(target);
        notifyGroup(getGroupOrThrow(groupId), targetUserId, "ROLE_CHANGED", null, "Vai trò của bạn trong nhóm đã được cập nhật");
    }

    @Transactional
    public void removeMember(Long groupId, Long targetUserId, Long requesterId, boolean ban, String reason) {
        GroupMember actor = requireModerator(groupId, requesterId);
        GroupMember target = memberRepository.findByGroupGroupIdAndUserUserId(groupId, targetUserId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy thành viên"));
        if (roleRank(actor.getRole()) <= roleRank(target.getRole())) throw ApiException.forbidden("Bạn không thể xử lý thành viên có vai trò ngang hoặc cao hơn");
        memberRepository.delete(target);
        if (ban) banRepository.save(GroupBan.builder().group(getGroupOrThrow(groupId)).user(target.getUser())
                .bannedBy(userService.getByIdOrThrow(requesterId)).reason(clean(reason)).build());
        notifyGroup(getGroupOrThrow(groupId), targetUserId, ban ? "BANNED" : "REMOVED", null,
                ban ? "Bạn đã bị cấm khỏi nhóm" : "Bạn đã bị xóa khỏi nhóm");
    }

    @Transactional
    public void unban(Long groupId, Long targetUserId, Long requesterId) {
        requireModerator(groupId, requesterId);
        banRepository.deleteByGroupGroupIdAndUserUserId(groupId, targetUserId);
    }

    @Transactional
    public void report(Long groupId, Long reporterId, GroupRequests.Report request) {
        requireMember(groupId, reporterId);
        String type = request.targetType().trim().toUpperCase(Locale.ROOT);
        if ("POST".equals(type)) getPostOrThrow(groupId, request.targetId(), reporterId);
        else if ("COMMENT".equals(type)) {
            GroupComment comment = commentRepository.findById(request.targetId()).orElseThrow(() -> ApiException.notFound("Không tìm thấy bình luận"));
            if (!comment.getPost().getGroup().getGroupId().equals(groupId)) throw ApiException.notFound("Không tìm thấy bình luận");
        } else throw ApiException.badRequest("Đối tượng báo cáo không hợp lệ");
        reportRepository.save(GroupReport.builder().group(getGroupOrThrow(groupId)).reporter(userService.getByIdOrThrow(reporterId))
                .targetType(type).targetId(request.targetId()).reason(request.reason().trim()).build());
        notifyGroup(getGroupOrThrow(groupId), getGroupOrThrow(groupId).getOwner().getUserId(), "REPORT", request.targetId(), "Có nội dung mới được báo cáo");
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> reports(Long groupId, Long requesterId) {
        requireModerator(groupId, requesterId);
        return reportRepository.findByGroupGroupIdAndStatusOrderByCreatedAtDesc(groupId, "OPEN").stream().map(report -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", report.getId()); item.put("targetType", report.getTargetType()); item.put("targetId", report.getTargetId());
            item.put("reason", report.getReason()); item.put("reporter", displayName(report.getReporter())); item.put("createdAt", report.getCreatedAt());
            return item;
        }).toList();
    }

    @Transactional
    public void decideReport(Long groupId, Long reportId, Long requesterId, boolean removeContent) {
        requireModerator(groupId, requesterId);
        GroupReport report = reportRepository.findById(reportId).filter(item -> item.getGroup().getGroupId().equals(groupId))
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy báo cáo"));
        if (removeContent && "POST".equals(report.getTargetType())) deletePost(groupId, report.getTargetId(), requesterId);
        if (removeContent && "COMMENT".equals(report.getTargetType())) deleteComment(groupId, report.getTargetId(), requesterId);
        report.setStatus(removeContent ? "ACTIONED" : "DISMISSED");
        reportRepository.save(report);
    }

    @Transactional
    public void invite(Long groupId, Long inviterId, Long inviteeId) {
        requireMember(groupId, inviterId);
        SocialGroup group = getGroupOrThrow(groupId);
        User invitee = userService.getByIdOrThrow(inviteeId);
        if (inviterId.equals(inviteeId)) throw ApiException.badRequest("Không thể tự mời chính mình");
        if (memberRepository.existsByGroupGroupIdAndUserUserId(groupId, inviteeId)) throw ApiException.conflict("Người này đã là thành viên");
        boolean friends = friendRequestRepository.findRelationship(inviterId, inviteeId).stream()
            .anyMatch(request -> "ACCEPTED".equals(request.getStatus().name()));
        if (!friends) throw ApiException.forbidden("Bạn chỉ có thể mời bạn bè đã kết nối");
        if (banRepository.findByGroupGroupIdAndUserUserId(groupId, inviteeId).isPresent()) throw ApiException.conflict("Người này đã bị cấm khỏi nhóm");
        Optional<GroupInvite> existingInvite = inviteRepository.findByGroupGroupIdAndInviteeUserId(groupId, inviteeId);
        if (existingInvite.isPresent() && "PENDING".equals(existingInvite.get().getStatus())) {
            throw ApiException.conflict("Lời mời đang chờ phản hồi");
        }
        GroupInvite invite = existingInvite
            .orElseGet(() -> GroupInvite.builder().group(group).invitee(invitee).invitedBy(userService.getByIdOrThrow(inviterId)).build());
        invite.setStatus("PENDING");
        inviteRepository.save(invite);
        notificationRepository.save(GroupNotification.builder().group(group).user(invitee).actor(userService.getByIdOrThrow(inviterId))
                .type("INVITE").referenceId(invite.getId()).message("Bạn được mời tham gia nhóm " + group.getName()).build());
    }

    @Transactional
    public void respondInvite(Long inviteId, Long userId, boolean accept) {
        GroupInvite invite = inviteRepository.findById(inviteId).filter(item -> item.getInvitee().getUserId().equals(userId))
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy lời mời"));
        if (!"PENDING".equals(invite.getStatus())) throw ApiException.conflict("Lời mời đã được xử lý");
        if (accept && banRepository.findByGroupGroupIdAndUserUserId(invite.getGroup().getGroupId(), userId).isPresent()) {
            throw ApiException.conflict("Bạn đang bị cấm khỏi nhóm này");
        }
        invite.setStatus(accept ? "ACCEPTED" : "DECLINED");
        if (accept) addMember(invite.getGroup(), invite.getInvitee(), "MEMBER");
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> notifications(Long userId) {
        return notificationRepository.findTop100ByUserUserIdOrderByCreatedAtDesc(userId).stream().map(notification -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", notification.getId()); item.put("groupId", notification.getGroup().getGroupId());
            item.put("groupName", notification.getGroup().getName()); item.put("type", notification.getType());
            item.put("message", notification.getMessage()); item.put("referenceId", notification.getReferenceId());
            item.put("read", notification.isRead()); item.put("createdAt", notification.getCreatedAt());
            return item;
        }).toList();
    }

    @Transactional
    public void markNotificationRead(Long notificationId, Long userId) {
        GroupNotification notification = notificationRepository.findByIdAndUserUserId(notificationId, userId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy thông báo"));
        notification.setRead(true);
        notificationRepository.save(notification);
    }

    @Transactional
    public void warnMember(Long groupId, Long targetUserId, Long requesterId, String message) {
        GroupMember actor = requireModerator(groupId, requesterId);
        GroupMember target = memberRepository.findByGroupGroupIdAndUserUserId(groupId, targetUserId)
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy thành viên"));
        if (roleRank(actor.getRole()) <= roleRank(target.getRole())) throw ApiException.forbidden("Bạn không thể cảnh cáo thành viên có vai trò ngang hoặc cao hơn");
        String warning = clean(message);
        if (warning == null) throw ApiException.badRequest("Nội dung cảnh cáo không được để trống");
        SocialGroup group = getGroupOrThrow(groupId);
        notificationRepository.save(GroupNotification.builder().group(group).user(userService.getByIdOrThrow(targetUserId))
                .actor(userService.getByIdOrThrow(requesterId)).type("WARNING").message("Cảnh cáo từ nhóm " + group.getName() + ": " + warning).build());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listBans(Long groupId, Long requesterId) {
        requireModerator(groupId, requesterId);
        return banRepository.findAll().stream().filter(ban -> ban.getGroup().getGroupId().equals(groupId)).map(ban -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("userId", ban.getUser().getUserId()); item.put("name", displayName(ban.getUser()));
            item.put("reason", ban.getReason()); item.put("createdAt", ban.getCreatedAt());
            return item;
        }).toList();
    }

    private SocialGroup requireReadableGroup(Long groupId, Long userId) {
        SocialGroup group = getGroupOrThrow(groupId);
        if ("PRIVATE".equals(group.getVisibility()) && !memberRepository.existsByGroupGroupIdAndUserUserId(groupId, userId)) {
            throw ApiException.forbidden("Nhóm này ở chế độ riêng tư");
        }
        if (banRepository.findByGroupGroupIdAndUserUserId(groupId, userId).isPresent()) throw ApiException.forbidden("Bạn không có quyền xem nhóm này");
        return group;
    }

    private GroupMember requireMember(Long groupId, Long userId) {
        requireReadableGroup(groupId, userId);
        return memberRepository.findByGroupGroupIdAndUserUserId(groupId, userId)
                .orElseThrow(() -> ApiException.forbidden("Bạn cần tham gia nhóm để thực hiện thao tác này"));
    }

    private GroupMember requireModerator(Long groupId, Long userId) {
        GroupMember member = requireMember(groupId, userId);
        if (!isModeratorRole(member.getRole())) throw ApiException.forbidden("Bạn không có quyền quản trị nhóm");
        return member;
    }

    private boolean isModeratorRole(String role) { return Set.of("OWNER", "ADMIN", "MODERATOR").contains(role); }

    private int roleRank(String role) {
        return switch (role) {
            case "OWNER" -> 3;
            case "ADMIN" -> 2;
            case "MODERATOR" -> 1;
            default -> 0;
        };
    }

    private GroupPost getPostOrThrow(Long groupId, Long postId, Long viewerId) {
        requireReadableGroup(groupId, viewerId);
        return postRepository.findByPostIdAndGroupGroupId(postId, groupId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy bài viết"));
    }

    private SocialGroup getGroupOrThrow(Long groupId) {
        return groupRepository.findById(groupId).orElseThrow(() -> ApiException.notFound("Không tìm thấy nhóm"));
    }

    private void addMember(SocialGroup group, User user, String role) {
        if (!memberRepository.existsByGroupGroupIdAndUserUserId(group.getGroupId(), user.getUserId())) {
            memberRepository.save(GroupMember.builder().group(group).user(user).role(role).build());
        }
    }

    private void deleteComments(Long postId) {
        List<GroupComment> comments = commentRepository.findByPostPostIdOrderByCreatedAtAsc(postId);
        Collections.reverse(comments);
        commentRepository.deleteAll(comments);
    }

    private void notifyGroup(SocialGroup group, Long targetId, String type, Long referenceId, String message) {
        if (targetId == null) return;
        notificationRepository.save(GroupNotification.builder().group(group).user(userService.getByIdOrThrow(targetId))
                .type(type).referenceId(referenceId).message(message).build());
    }

    private boolean containsSpam(SocialGroup group, String content) {
        if (content == null || group.getSpamKeywords() == null || group.getSpamKeywords().isBlank()) return false;
        String normalized = content.toLowerCase(Locale.ROOT);
        return Arrays.stream(group.getSpamKeywords().split(",")).map(String::trim).filter(word -> !word.isEmpty())
                .anyMatch(word -> normalized.contains(word.toLowerCase(Locale.ROOT)));
    }

    private void enforcePostRateLimit(Long groupId, Long authorId) {
        if (postRepository.countByGroupGroupIdAndAuthorUserIdAndCreatedAtAfter(groupId, authorId,
                java.time.LocalDateTime.now().minusMinutes(1)) >= 5) {
            throw ApiException.conflict("Bạn đăng nội dung quá nhanh. Vui lòng thử lại sau.");
        }
    }

    private Map<String, Object> groupSummary(SocialGroup group, Long viewerId) {
        GroupMember membership = memberRepository.findByGroupGroupIdAndUserUserId(group.getGroupId(), viewerId).orElse(null);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("groupId", group.getGroupId()); result.put("name", group.getName()); result.put("description", group.getDescription());
        result.put("avatar", group.getAvatar()); result.put("coverImage", group.getCoverImage()); result.put("category", group.getCategory());
        result.put("visibility", group.getVisibility()); result.put("ownerId", group.getOwner().getUserId());
        result.put("ownerName", displayName(group.getOwner())); result.put("memberCount", memberRepository.countByGroupGroupId(group.getGroupId()));
        result.put("joined", membership != null); result.put("role", membership == null ? null : membership.getRole());
        result.put("postApprovalRequired", group.isPostApprovalRequired()); result.put("createdAt", group.getCreatedAt());
        if (membership != null && isModeratorRole(membership.getRole())) result.put("spamKeywords", group.getSpamKeywords());
        return result;
    }

    private Map<String, Object> memberResponse(GroupMember member) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userId", member.getUser().getUserId()); result.put("name", displayName(member.getUser()));
        result.put("username", member.getUser().getUsername()); result.put("avatar", member.getUser().getAvatar());
        result.put("role", member.getRole()); result.put("joinedAt", member.getJoinedAt());
        return result;
    }

    private Map<String, Object> postResponse(GroupPost post, Long viewerId) {
        GroupReaction viewerReaction = reactionRepository.findByPostPostIdAndUserUserId(post.getPostId(), viewerId).orElse(null);
        List<Map<String, Object>> comments = commentRepository.findByPostPostIdOrderByCreatedAtAsc(post.getPostId()).stream()
                .map(this::commentResponse).toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("postId", post.getPostId()); result.put("groupId", post.getGroup().getGroupId());
        result.put("authorId", post.getAuthor().getUserId()); result.put("authorName", displayName(post.getAuthor()));
        result.put("authorAvatar", post.getAuthor().getAvatar()); result.put("content", post.getContent());
        result.put("mediaUrl", post.getMediaUrl()); result.put("mediaType", post.getMediaType()); result.put("status", post.getStatus());
        result.put("postType", post.getPostType());
        result.put("pinned", post.isPinned()); result.put("createdAt", post.getCreatedAt());
        result.put("reactionCount", reactionRepository.countByPostPostId(post.getPostId()));
        result.put("viewerReaction", viewerReaction == null ? null : viewerReaction.getReactionType());
        result.put("comments", comments);
        pollRepository.findByPostPostId(post.getPostId()).ifPresent(poll -> result.put("poll", pollResponse(poll, viewerId)));
        return result;
    }

    private Map<String, Object> pollResponse(GroupPoll poll, Long viewerId) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("pollId", poll.getId()); result.put("endsAt", poll.getEndsAt());
        result.put("options", pollOptionRepository.findByPollIdOrderByIdAsc(poll.getId()).stream().map(option -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("optionId", option.getId()); item.put("label", option.getLabel());
            item.put("votes", pollVoteRepository.countByOptionId(option.getId()));
            item.put("selected", pollVoteRepository.findByPollIdAndUserUserId(poll.getId(), viewerId)
                    .map(vote -> vote.getOption().getId().equals(option.getId())).orElse(false));
            return item;
        }).toList());
        return result;
    }

    private Map<String, Object> eventResponse(GroupEvent event, Long viewerId) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("eventId", event.getId()); result.put("title", event.getTitle());
        result.put("description", event.getDescription()); result.put("location", event.getLocation());
        result.put("startsAt", event.getStartsAt()); result.put("endsAt", event.getEndsAt());
        result.put("createdBy", event.getCreatedBy().getUserId()); result.put("creatorName", displayName(event.getCreatedBy()));
        result.put("participantCount", eventParticipantRepository.countByEventId(event.getId()));
        result.put("participating", eventParticipantRepository.findByEventIdAndUserUserId(event.getId(), viewerId).isPresent());
        return result;
    }

    private void deletePostChildren(GroupPost post) {
        deleteComments(post.getPostId());
        reactionRepository.deleteAll(reactionRepository.findByPostPostId(post.getPostId()));
        pollRepository.findByPostPostId(post.getPostId()).ifPresent(poll -> {
            pollVoteRepository.deleteByPollId(poll.getId());
            pollOptionRepository.deleteByPollId(poll.getId());
            pollRepository.delete(poll);
        });
    }

    private Map<String, Object> commentResponse(GroupComment comment) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("commentId", comment.getCommentId()); result.put("parentCommentId", comment.getParentComment() == null ? null : comment.getParentComment().getCommentId());
        result.put("authorId", comment.getAuthor().getUserId()); result.put("authorName", displayName(comment.getAuthor()));
        result.put("authorAvatar", comment.getAuthor().getAvatar()); result.put("content", comment.getContent()); result.put("createdAt", comment.getCreatedAt());
        return result;
    }

    private Comparator<GroupPost> postComparator(String sort) {
        Comparator<GroupPost> newest = Comparator.comparing(GroupPost::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder()));
        if ("OLDEST".equalsIgnoreCase(sort)) return Comparator.comparing(GroupPost::isPinned).reversed().thenComparing(GroupPost::getCreatedAt);
        return Comparator.comparing(GroupPost::isPinned).reversed().thenComparing(newest);
    }

    private String normalizeVisibility(String value) {
        String visibility = value == null ? "PUBLIC" : value.trim().toUpperCase(Locale.ROOT);
        if (!VISIBILITIES.contains(visibility)) throw ApiException.badRequest("Chế độ nhóm không hợp lệ");
        return visibility;
    }

    private String clean(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private String nullSafe(String value) { return value == null ? "" : value; }
    private String displayName(User user) { return user.getDisplayName() == null || user.getDisplayName().isBlank() ? user.getUsername() : user.getDisplayName(); }
}