package com.example.messaging.forum.entity;
import com.example.messaging.entity.User; import jakarta.persistence.*; import lombok.*; import java.time.LocalDateTime;
@Entity @Table(name="forum_bookmarks",uniqueConstraints=@UniqueConstraint(columnNames={"user_id","topic_id"})) @Getter @Setter @NoArgsConstructor
public class ForumBookmark { @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id; @ManyToOne(optional=false) @JoinColumn(name="user_id") private User user; @ManyToOne(optional=false) @JoinColumn(name="topic_id") private ForumTopic topic; private LocalDateTime createdAt; @PrePersist void create(){createdAt=LocalDateTime.now();} }
