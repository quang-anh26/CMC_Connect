package com.example.messaging.forum.controller;

import com.example.messaging.entity.User;
import com.example.messaging.forum.entity.ForumFaculty;
import com.example.messaging.forum.entity.ForumMajor;
import com.example.messaging.forum.entity.ForumTopic;
import com.example.messaging.forum.repository.ForumAttachmentRepository;
import com.example.messaging.forum.repository.ForumBookmarkRepository;
import com.example.messaging.forum.repository.ForumCategoryRepository;
import com.example.messaging.forum.repository.ForumCourseRepository;
import com.example.messaging.forum.repository.ForumFacultyRepository;
import com.example.messaging.forum.repository.ForumMajorRepository;
import com.example.messaging.forum.repository.ForumReplyRepository;
import com.example.messaging.forum.repository.ForumReportRepository;
import com.example.messaging.forum.repository.ForumTopicRepository;
import com.example.messaging.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ForumControllerTest {
    private static final Long OWNER_ID = 10L;
    private static final Long OTHER_USER_ID = 20L;
    private static final Long TOPIC_ID = 30L;

    @Mock private ForumTopicRepository topics;
    @Mock private ForumReplyRepository replies;
    @Mock private ForumCategoryRepository categories;
    @Mock private ForumCourseRepository courses;
    @Mock private ForumFacultyRepository faculties;
    @Mock private ForumMajorRepository majors;
    @Mock private ForumBookmarkRepository bookmarks;
    @Mock private ForumReportRepository reports;
    @Mock private ForumAttachmentRepository attachments;
    @Mock private UserRepository users;
    @InjectMocks private ForumController controller;

    @Test
    void topicIsPublishedImmediately() {
        User author = user(OWNER_ID);
        when(users.findById(OWNER_ID)).thenReturn(Optional.of(author));
        when(replies.countByTopicId(any())).thenReturn(0L);
        when(topics.save(any(ForumTopic.class))).thenAnswer(invocation -> {
            ForumTopic topic = invocation.getArgument(0);
            topic.setId(TOPIC_ID);
            topic.setCreatedAt(LocalDateTime.now());
            return topic;
        });

        var result = controller.create(OWNER_ID,
                new ForumController.TopicRequest(
                        "Study notes", "Useful material", "QUESTION", null, null, null, null, null, null));

        assertEquals("PUBLISHED", result.get("status"));
        verify(topics).save(any(ForumTopic.class));
    }

    @Test
    void resourceCannotBeCreatedThroughJsonWithoutAnAttachment() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> controller.create(OWNER_ID,
                        new ForumController.TopicRequest(
                                "Exam", "Exam file", "RESOURCE", null, null, null, null, "EXAM", null)));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        verify(topics, never()).save(any(ForumTopic.class));
    }

    @Test
    void rejectsMajorThatDoesNotBelongToSelectedFaculty() {
        ForumFaculty selectedFaculty = new ForumFaculty();
        selectedFaculty.setId(1L);
        ForumFaculty otherFaculty = new ForumFaculty();
        otherFaculty.setId(2L);
        ForumMajor major = new ForumMajor();
        major.setId(3L);
        major.setFaculty(otherFaculty);
        when(users.findById(OWNER_ID)).thenReturn(Optional.of(user(OWNER_ID)));
        when(faculties.findById(1L)).thenReturn(Optional.of(selectedFaculty));
        when(majors.findById(3L)).thenReturn(Optional.of(major));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> controller.create(OWNER_ID,
                        new ForumController.TopicRequest(
                                "Question", "Content", "QUESTION", null, null, 1L, 3L, null, null)));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        verify(topics, never()).save(any(ForumTopic.class));
    }

    @Test
    void usersCannotEditOrDeleteAnotherAuthorsTopic() {
        ForumTopic topic = topic();
        when(topics.findById(TOPIC_ID)).thenReturn(Optional.of(topic));

        ResponseStatusException editError = assertThrows(ResponseStatusException.class,
                () -> controller.update(OTHER_USER_ID, TOPIC_ID,
                        new ForumController.TopicRequest(
                                "Changed", "Changed content", "QUESTION", null, null, null, null, null, null)));
        ResponseStatusException deleteError = assertThrows(ResponseStatusException.class,
                () -> controller.delete(OTHER_USER_ID, TOPIC_ID));

        assertEquals(HttpStatus.FORBIDDEN, editError.getStatusCode());
        assertEquals(HttpStatus.FORBIDDEN, deleteError.getStatusCode());
        verify(topics, never()).save(any(ForumTopic.class));
    }

    @Test
    void authorDeleteHidesTopicWithoutRemovingItsRecord() {
        ForumTopic topic = topic();
        when(topics.findById(TOPIC_ID)).thenReturn(Optional.of(topic));

        var response = controller.delete(OWNER_ID, TOPIC_ID);

        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
        assertEquals("DELETED", topic.getStatus());
        verify(topics).save(topic);
    }

    private ForumTopic topic() {
        ForumTopic topic = new ForumTopic();
        topic.setId(TOPIC_ID);
        topic.setAuthor(user(OWNER_ID));
        topic.setTitle("Original topic");
        topic.setContent("Original content");
        topic.setType("QUESTION");
        topic.setStatus("PUBLISHED");
        topic.setCreatedAt(LocalDateTime.now());
        return topic;
    }

    private User user(Long id) {
        return User.builder()
                .userId(id)
                .username("student" + id)
                .displayName("Student " + id)
                .build();
    }
}
