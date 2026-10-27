package com.example.messaging.service;

import com.example.messaging.entity.SocialPost;
import com.example.messaging.entity.User;
import com.example.messaging.exception.ApiException;
import com.example.messaging.repository.FriendRequestRepository;
import com.example.messaging.repository.SavedItemRepository;
import com.example.messaging.repository.SocialPostCommentRepository;
import com.example.messaging.repository.SocialPostReactionRepository;
import com.example.messaging.repository.SocialPostRepository;
import com.example.messaging.security.VideoMediaTokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FeedPrivacyTest {
    private static final Long POST_ID = 10L;
    private static final Long AUTHOR_ID = 20L;

    @Mock private SocialPostRepository postRepository;
    @Mock private SocialPostReactionRepository reactionRepository;
    @Mock private SocialPostCommentRepository commentRepository;
    @Mock private UserService userService;
    @Mock private FriendRequestRepository friendRequestRepository;
    @Mock private VideoMediaTokenService videoMediaTokenService;
    @Mock private SavedItemRepository savedItemRepository;
    @Mock private NotificationService notificationService;
    @InjectMocks private FeedService feedService;

    private SocialPost post;

    @BeforeEach
    void setUp() {
        User author = mock(User.class);
        when(author.getUserId()).thenReturn(AUTHOR_ID);
        post = SocialPost.builder().postId(POST_ID).author(author).content("Test post").privacy("PUBLIC").build();
        when(postRepository.findById(POST_ID)).thenReturn(Optional.of(post));
    }

    @Test
    void ownerCanChangePostToEachSupportedPrivacy() {
        when(post.getAuthor().getDisplayName()).thenReturn("Author");
        when(postRepository.save(post)).thenReturn(post);
        when(reactionRepository.findByPostPostIdAndUserUserId(POST_ID, AUTHOR_ID)).thenReturn(Optional.empty());
        when(commentRepository.findByPostPostIdOrderByCreatedAtAsc(POST_ID)).thenReturn(List.of());
        when(reactionRepository.countByPostPostId(POST_ID)).thenReturn(0L);
        when(postRepository.countBySharedPostPostId(POST_ID)).thenReturn(0L);
        when(savedItemRepository.existsByUserUserIdAndContentTypeAndContentId(AUTHOR_ID, "POST", POST_ID))
                .thenReturn(false);
        for (String privacy : List.of("FRIENDS", "PRIVATE", "PUBLIC")) {
            var response = feedService.updatePrivacy(POST_ID, AUTHOR_ID, privacy);

            assertEquals(privacy, post.getPrivacy());
            assertEquals(privacy, response.getPrivacy());
        }
        verify(postRepository, times(3)).save(post);
    }

    @Test
    void nonOwnerCannotChangePostPrivacy() {
        ApiException error = assertThrows(ApiException.class,
                () -> feedService.updatePrivacy(POST_ID, 99L, "PRIVATE"));

        assertEquals(403, error.getStatus().value());
        verify(postRepository, never()).save(any());
    }

    @Test
    void unsupportedPrivacyIsRejectedWithoutSaving() {
        ApiException error = assertThrows(ApiException.class,
                () -> feedService.updatePrivacy(POST_ID, AUTHOR_ID, "FOLLOWERS"));

        assertEquals(400, error.getStatus().value());
        verify(postRepository, never()).save(any());
    }
}
