package com.example.messaging.forum.controller;

import com.example.messaging.entity.User;
import com.example.messaging.forum.entity.ForumAttachment;
import com.example.messaging.forum.entity.ForumFaculty;
import com.example.messaging.forum.entity.ForumTopic;
import com.example.messaging.forum.repository.ForumAttachmentRepository;
import com.example.messaging.forum.repository.ForumCategoryRepository;
import com.example.messaging.forum.repository.ForumCourseRepository;
import com.example.messaging.forum.repository.ForumFacultyRepository;
import com.example.messaging.forum.repository.ForumMajorRepository;
import com.example.messaging.forum.repository.ForumReplyRepository;
import com.example.messaging.forum.repository.ForumTopicRepository;
import com.example.messaging.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ForumFileControllerTest {
    private static final String SUBMISSION_KEY = "3b8c2ac7-09ec-4c8f-a01a-590581a37e44";

    @Mock private ForumTopicRepository topics;
    @Mock private ForumAttachmentRepository attachments;
    @Mock private ForumCategoryRepository categories;
    @Mock private ForumCourseRepository courses;
    @Mock private ForumFacultyRepository faculties;
    @Mock private ForumMajorRepository majors;
    @Mock private ForumReplyRepository replies;
    @Mock private UserRepository users;
    @InjectMocks private ForumFileController controller;

    @Test
    void resourceRequiresAFile() {
        when(topics.findBySubmissionKey(SUBMISSION_KEY)).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> controller.createTopic(1L, SUBMISSION_KEY, "Study material", "Description",
                        "RESOURCE", 1L, null, null, null, "STUDY_MATERIAL", null, null));

        assertEquals(400, error.getStatusCode().value());
        verify(topics, never()).saveAndFlush(any(ForumTopic.class));
    }

    @Test
    void acceptsDocxAndReturnsPrivateDownloadMetadata(@TempDir Path uploadDirectory) throws Exception {
        ReflectionTestUtils.setField(controller, "uploadDir", uploadDirectory.toString());
        when(topics.findBySubmissionKey(SUBMISSION_KEY)).thenReturn(Optional.empty());
        User author = User.builder().userId(1L).username("student").displayName("Student").build();
        when(users.findById(1L)).thenReturn(Optional.of(author));
        ForumFaculty faculty = new ForumFaculty();
        faculty.setId(5L);
        faculty.setName("Faculty");
        when(faculties.findById(5L)).thenReturn(Optional.of(faculty));
        when(topics.saveAndFlush(any(ForumTopic.class))).thenAnswer(invocation -> {
            ForumTopic topic = invocation.getArgument(0);
            topic.setId(10L);
            topic.setCreatedAt(LocalDateTime.now());
            return topic;
        });
        when(attachments.saveAndFlush(any(ForumAttachment.class))).thenAnswer(invocation -> {
            ForumAttachment attachment = invocation.getArgument(0);
            attachment.setId(20L);
            return attachment;
        });
        when(replies.countByTopicId(10L)).thenReturn(0L);
        when(attachments.findByTopicIdOrderByCreatedAtAsc(10L)).thenAnswer(invocation -> List.of(
                attachmentsCaptorValue()));

        MockMultipartFile file = new MockMultipartFile(
                "file", "notes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                new byte[] {'P', 'K', 3, 4, 0, 0, 1});

        var result = controller.createTopic(1L, SUBMISSION_KEY, "Study material", "Description",
                "QUESTION", 5L, null, null, null, null, null, file);

        assertEquals(10L, result.get("id"));
        @SuppressWarnings("unchecked")
        List<java.util.Map<String, Object>> returnedFiles =
                (List<java.util.Map<String, Object>>) result.get("attachments");
        assertEquals("notes.docx", returnedFiles.get(0).get("name"));
        assertEquals("docx", returnedFiles.get(0).get("extension"));
        assertEquals("/api/forum/attachments/20/download", returnedFiles.get(0).get("downloadUrl"));
        try (var files = Files.list(uploadDirectory)) {
            assertEquals(1, files.count());
        }
    }

    private ForumAttachment attachmentsCaptorValue() {
        ForumAttachment attachment = new ForumAttachment();
        attachment.setId(20L);
        attachment.setOriginalName("notes.docx");
        attachment.setContentType("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        attachment.setSizeBytes(7);
        return attachment;
    }
}
