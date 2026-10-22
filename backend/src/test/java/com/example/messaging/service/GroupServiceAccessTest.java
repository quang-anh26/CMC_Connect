package com.example.messaging.service;

import com.example.messaging.entity.GroupMember;
import com.example.messaging.entity.GroupPost;
import com.example.messaging.entity.SocialGroup;
import com.example.messaging.entity.User;
import com.example.messaging.exception.ApiException;
import com.example.messaging.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GroupServiceAccessTest {
    private static final Long VIEWER_ID = 42L;
    private static final Long GROUP_ID = 7L;

    @Mock private SocialGroupRepository groupRepository;
    @Mock private GroupMemberRepository memberRepository;
    @Mock private GroupJoinRequestRepository joinRequestRepository;
    @Mock private GroupPostRepository postRepository;
    @Mock private GroupCommentRepository commentRepository;
    @Mock private GroupReactionRepository reactionRepository;
    @Mock private GroupBanRepository banRepository;
    @Mock private GroupReportRepository reportRepository;
    @Mock private GroupNotificationRepository notificationRepository;
    @Mock private GroupInviteRepository inviteRepository;
    @Mock private GroupPollRepository pollRepository;
    @Mock private GroupPollOptionRepository pollOptionRepository;
    @Mock private GroupPollVoteRepository pollVoteRepository;
    @Mock private GroupEventRepository eventRepository;
    @Mock private GroupEventParticipantRepository eventParticipantRepository;
    @Mock private FriendRequestRepository friendRequestRepository;
    @Mock private UserService userService;
    @Mock private com.example.messaging.config.UploadDirectory uploadDirectory;
    @InjectMocks private GroupService groupService;

    @Test
    void discoveryIncludesPrivateAndPublicGroups() {
        SocialGroup publicGroup = group(1L, "PUBLIC");
        SocialGroup privateGroup = group(2L, "PRIVATE");
        when(groupRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(privateGroup, publicGroup));
        when(memberRepository.findByGroupGroupIdAndUserUserId(anyLong(), eq(VIEWER_ID))).thenReturn(Optional.empty());
        when(memberRepository.countByGroupGroupId(anyLong())).thenReturn(3L);

        List<java.util.Map<String, Object>> result = groupService.listGroups(VIEWER_ID, null, false);

        assertEquals(List.of(2L, 1L), result.stream().map(item -> item.get("groupId")).toList());
        verify(groupRepository).findAllByOrderByCreatedAtDesc();
    }

    @Test
    void nonMemberCanReadPrivateGroupIntroduction() {
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group(GROUP_ID, "PRIVATE")));
        when(banRepository.findByGroupGroupIdAndUserUserId(GROUP_ID, VIEWER_ID)).thenReturn(Optional.empty());
        when(memberRepository.findByGroupGroupIdAndUserUserId(GROUP_ID, VIEWER_ID)).thenReturn(Optional.empty());
        when(memberRepository.countByGroupGroupId(GROUP_ID)).thenReturn(3L);

        java.util.Map<String, Object> result = groupService.getGroup(GROUP_ID, VIEWER_ID);

        assertEquals("PRIVATE", result.get("visibility"));
        assertEquals(false, result.get("joined"));
        assertEquals(3L, result.get("memberCount"));
        verifyNoInteractions(postRepository, eventRepository);
    }

    @Test
    void nonMemberCannotReadPrivatePosts() {
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group(GROUP_ID, "PRIVATE")));
        when(banRepository.findByGroupGroupIdAndUserUserId(GROUP_ID, VIEWER_ID)).thenReturn(Optional.empty());
        when(memberRepository.findByGroupGroupIdAndUserUserId(GROUP_ID, VIEWER_ID)).thenReturn(Optional.empty());

        ApiException error = assertThrows(ApiException.class,
                () -> groupService.listPosts(GROUP_ID, VIEWER_ID, null, "NEWEST", false));

        assertEquals(403, error.getStatus().value());
        verifyNoInteractions(postRepository);
    }

    @Test
    void nonMemberCannotReadPrivateMembersOrEvents() {
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group(GROUP_ID, "PRIVATE")));
        when(banRepository.findByGroupGroupIdAndUserUserId(GROUP_ID, VIEWER_ID)).thenReturn(Optional.empty());
        when(memberRepository.findByGroupGroupIdAndUserUserId(GROUP_ID, VIEWER_ID)).thenReturn(Optional.empty());

        ApiException membersError = assertThrows(ApiException.class,
                () -> groupService.listMembers(GROUP_ID, VIEWER_ID));
        ApiException eventsError = assertThrows(ApiException.class,
                () -> groupService.listEvents(GROUP_ID, VIEWER_ID));

        assertEquals(403, membersError.getStatus().value());
        assertEquals(403, eventsError.getStatus().value());
        verify(memberRepository, never()).findByGroupGroupIdOrderByJoinedAtAsc(GROUP_ID);
        verifyNoInteractions(eventRepository);
    }

    @Test
    void memberCanReadPrivatePosts() {
        GroupMember membership = GroupMember.builder().role("MEMBER").build();
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group(GROUP_ID, "PRIVATE")));
        when(banRepository.findByGroupGroupIdAndUserUserId(GROUP_ID, VIEWER_ID)).thenReturn(Optional.empty());
        when(memberRepository.findByGroupGroupIdAndUserUserId(GROUP_ID, VIEWER_ID)).thenReturn(Optional.of(membership));
        when(postRepository.findByGroupGroupIdAndStatusOrderByPinnedDescCreatedAtDesc(GROUP_ID, "PUBLISHED"))
                .thenReturn(List.of());

        List<java.util.Map<String, Object>> posts =
                groupService.listPosts(GROUP_ID, VIEWER_ID, null, "NEWEST", false);

        assertEquals(0, posts.size());
        verify(postRepository).findByGroupGroupIdAndStatusOrderByPinnedDescCreatedAtDesc(GROUP_ID, "PUBLISHED");
    }

    @Test
    void nonMemberCanReadPublicPosts() {
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group(GROUP_ID, "PUBLIC")));
        when(banRepository.findByGroupGroupIdAndUserUserId(GROUP_ID, VIEWER_ID)).thenReturn(Optional.empty());
        when(memberRepository.findByGroupGroupIdAndUserUserId(GROUP_ID, VIEWER_ID)).thenReturn(Optional.empty());
        when(postRepository.findByGroupGroupIdAndStatusOrderByPinnedDescCreatedAtDesc(GROUP_ID, "PUBLISHED"))
                .thenReturn(List.of());

        List<java.util.Map<String, Object>> posts =
                groupService.listPosts(GROUP_ID, VIEWER_ID, null, "NEWEST", false);

        assertEquals(0, posts.size());
        verify(postRepository).findByGroupGroupIdAndStatusOrderByPinnedDescCreatedAtDesc(GROUP_ID, "PUBLISHED");
    }

    @Test
    void nonMemberCannotReadLegacyStaticMediaFromPrivateGroup() {
        GroupPost privatePost = GroupPost.builder().group(group(GROUP_ID, "PRIVATE"))
                .mediaUrl("/uploads/private-image.png").build();
        when(postRepository.findAllByMediaUrl("/uploads/private-image.png")).thenReturn(List.of(privatePost));
        when(memberRepository.existsByGroupGroupIdAndUserUserId(GROUP_ID, VIEWER_ID)).thenReturn(false);

        ApiException error = assertThrows(ApiException.class,
                () -> groupService.authorizeStaticUpload("/uploads/private-image.png", VIEWER_ID));

        assertEquals(403, error.getStatus().value());
    }

    private SocialGroup group(Long id, String visibility) {
        User owner = User.builder()
                .userId(100L)
                .username("owner")
                .displayName("Owner")
                .build();
        return SocialGroup.builder()
                .groupId(id)
                .owner(owner)
                .name("Group " + id)
                .visibility(visibility)
                .build();
    }
}
