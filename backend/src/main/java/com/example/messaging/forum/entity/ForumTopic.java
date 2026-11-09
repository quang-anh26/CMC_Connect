package com.example.messaging.forum.entity;
import com.example.messaging.entity.User; import jakarta.persistence.*; import lombok.*; import java.time.LocalDateTime;
@Entity @Table(name="forum_topics", indexes={@Index(name="idx_forum_topics_created",columnList="created_at"),@Index(name="idx_forum_topics_status",columnList="status")}) @Getter @Setter @NoArgsConstructor
public class ForumTopic {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(optional=false,fetch=FetchType.LAZY) @JoinColumn(name="author_id") private User author;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="category_id") private ForumCategory category;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="course_id") private ForumCourse course;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="faculty_id") private ForumFaculty faculty;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="major_id") private ForumMajor major;
 @Column(name="submission_key",length=36,unique=true) private String submissionKey;
 @Column(name="resource_kind",length=32) private String resourceKind;
 @Column(nullable=false,length=20) private String type;
 @Column(nullable=false,length=180) private String title;
 @Column(nullable=false,columnDefinition="TEXT") private String content;
 @Column(length=500) private String source;
 @Column(nullable=false,length=20) private String status="PUBLISHED";
 private long viewCount=0;
 private LocalDateTime createdAt; private LocalDateTime updatedAt;
 @PrePersist void create(){createdAt=updatedAt=LocalDateTime.now();}
 @PreUpdate void update(){updatedAt=LocalDateTime.now();}
}
