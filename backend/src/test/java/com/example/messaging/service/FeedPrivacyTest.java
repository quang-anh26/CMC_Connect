package com.example.messaging.service;

import com.example.messaging.entity.SocialPost;
import com.example.messaging.entity.SocialPostReaction;
import com.example.messaging.entity.User;
import com.example.messaging.dto.feed.UpdatePostRequest;
import com.example.messaging.exception.ApiException;
import com.example.messaging.repository.HiddenPostAuthorRepository;
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
    @Mock private HiddenPostAuthorRepository hiddenPostAuthorRepository;
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
        User author = User.builder().userId(AUTHOR_ID).username("author").password("password").build();
        post = SocialPost.builder().postId(POST_ID).author(author).content("Test post").privacy("PUBLIC").build();
    }

    private void postExists() {
        when(postRepository.findById(POST_ID)).thenReturn(Optional.of(post));
    }

    @Test
    void ownerCanChangePostToEachSupportedPrivacy() {
        postExists();
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
        postExists();
        ApiException error = assertThrows(ApiException.class,
                () -> feedService.updatePrivacy(POST_ID, 99L, "PRIVATE"));

        assertEquals(403, error.getStatus().value());
        verify(postRepository, never()).save(any());
    }

    @Test
    void unsupportedPrivacyIsRejectedWithoutSaving() {
        postExists();
        ApiException error = assertThrows(ApiException.class,
                () -> feedService.updatePrivacy(POST_ID, AUTHOR_ID, "FOLLOWERS"));

        assertEquals(400, error.getStatus().value());
        verify(postRepository, never()).save(any());
    }

    @Test
    void nonOwnerCannotEditPost() {
        postExists();
        UpdatePostRequest request = new UpdatePostRequest();
        request.setContent("Changed content");

        ApiException error = assertThrows(ApiException.class,
                () -> feedService.updatePost(POST_ID, 99L, request));

        assertEquals(403, error.getStatus().value());
        verify(postRepository, never()).save(any());
    }

    @Test
    void ownerCanEditPostContent() {
        postExists();
        UpdatePostRequest request = new UpdatePostRequest();
        request.setContent("Updated content");
        when(postRepository.save(post)).thenReturn(post);
        when(reactionRepository.findByPostPostIdAndUserUserId(POST_ID, AUTHOR_ID)).thenReturn(Optional.empty());
        when(reactionRepository.findByPostPostIdOrderByCreatedAtAsc(POST_ID)).thenReturn(List.of());
        when(commentRepository.findByPostPostIdOrderByCreatedAtAsc(POST_ID)).thenReturn(List.of());
        when(reactionRepository.countByPostPostId(POST_ID)).thenReturn(0L);
        when(postRepository.countBySharedPostPostId(POST_ID)).thenReturn(0L);
        when(savedItemRepository.existsByUserUserIdAndContentTypeAndContentId(AUTHOR_ID, "POST", POST_ID))
                .thenReturn(false);

        var response = feedService.updatePost(POST_ID, AUTHOR_ID, request);

        assertEquals("Updated content", post.getContent());
        assertEquals("Updated content", response.getContent());
    }

    @Test
    void notInterestedAuthorPostsAreExcludedFromFeed() {
        Long viewerId = 99L;
        when(hiddenPostAuthorRepository.findHiddenAuthorIdsByViewerId(viewerId)).thenReturn(List.of(AUTHOR_ID));
        when(postRepository.findAll()).thenReturn(List.of(post));

        assertEquals(List.of(), feedService.list(viewerId));
    }

    @Test
    void hidingAnAuthorIsStoredOnlyOnce() {
        Long viewerId = 99L;
        User viewer = mock(User.class);
        User author = mock(User.class);
        when(userService.getByIdOrThrow(viewerId)).thenReturn(viewer);
        when(userService.getByIdOrThrow(AUTHOR_ID)).thenReturn(author);
        when(hiddenPostAuthorRepository.existsByViewerUserIdAndAuthorUserId(viewerId, AUTHOR_ID)).thenReturn(false);

        feedService.hideAuthor(viewerId, AUTHOR_ID);

        verify(hiddenPostAuthorRepository).save(any());
    }

    @Test
    void reactionTypeIsReturnedForTheViewerAndSummary() {
        SocialPostReaction reaction = SocialPostReaction.builder()
                .post(post)
                .reactionType("HAHA")
                .build();
        when(reactionRepository.findByPostPostIdAndUserUserId(POST_ID, AUTHOR_ID)).thenReturn(Optional.of(reaction));
        when(reactionRepository.findByPostPostIdOrderByCreatedAtAsc(POST_ID)).thenReturn(List.of(reaction));
        when(commentRepository.findByPostPostIdOrderByCreatedAtAsc(POST_ID)).thenReturn(List.of());
        when(reactionRepository.countByPostPostId(POST_ID)).thenReturn(1L);
        when(postRepository.countBySharedPostPostId(POST_ID)).thenReturn(0L);
        when(savedItemRepository.existsByUserUserIdAndContentTypeAndContentId(AUTHOR_ID, "POST", POST_ID))
                .thenReturn(false);

        var response = feedService.toResponse(post, AUTHOR_ID);

        assertEquals("HAHA", response.getViewerReaction());
        assertEquals("HAHA", response.getReactionSummary().get(0).getReactionType());
        assertEquals(1L, response.getReactionSummary().get(0).getCount());
    }
}
