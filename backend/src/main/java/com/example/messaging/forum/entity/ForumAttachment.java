package com.example.messaging.forum.entity;
import jakarta.persistence.*; import lombok.*; import java.time.LocalDateTime;
@Entity @Table(name="forum_attachments") @Getter @Setter @NoArgsConstructor
public class ForumAttachment { @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id; @ManyToOne(optional=false) @JoinColumn(name="topic_id") private ForumTopic topic; @Column(nullable=false,length=255) private String originalName; @Column(nullable=false,length=255,unique=true) private String storedName; @Column(nullable=false,length=120) private String contentType; @Column(nullable=false) private long sizeBytes; private LocalDateTime createdAt; @PrePersist void create(){createdAt=LocalDateTime.now();} }
