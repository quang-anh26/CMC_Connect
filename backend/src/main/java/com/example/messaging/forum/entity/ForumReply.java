package com.example.messaging.forum.entity;
import com.example.messaging.entity.User; import jakarta.persistence.*; import lombok.*; import java.time.LocalDateTime;
@Entity @Table(name="forum_replies") @Getter @Setter @NoArgsConstructor
public class ForumReply {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(optional=false) @JoinColumn(name="topic_id") private ForumTopic topic;
 @ManyToOne(optional=false) @JoinColumn(name="author_id") private User author;
 @Column(nullable=false,columnDefinition="TEXT") private String content;
 private LocalDateTime createdAt;
 @PrePersist void create(){createdAt=LocalDateTime.now();}
}
