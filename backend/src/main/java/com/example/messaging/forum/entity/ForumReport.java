package com.example.messaging.forum.entity;
import com.example.messaging.entity.User; import jakarta.persistence.*; import lombok.*; import java.time.LocalDateTime;
@Entity @Table(name="forum_reports") @Getter @Setter @NoArgsConstructor
public class ForumReport { @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id; @ManyToOne(optional=false) @JoinColumn(name="topic_id") private ForumTopic topic; @ManyToOne(optional=false) @JoinColumn(name="reporter_id") private User reporter; @Column(nullable=false,length=500) private String reason; @Column(nullable=false,length=20) private String status="OPEN"; private LocalDateTime createdAt; @PrePersist void create(){createdAt=LocalDateTime.now();} }
