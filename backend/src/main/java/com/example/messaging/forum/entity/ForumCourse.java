package com.example.messaging.forum.entity;
import jakarta.persistence.*; import lombok.*; import java.time.LocalDateTime;
@Entity @Table(name="forum_courses") @Getter @Setter @NoArgsConstructor
public class ForumCourse {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(nullable=false,length=30) private String code;
 @Column(nullable=false,length=150) private String name;
 @Column(nullable=false) private boolean active=true;
 private LocalDateTime createdAt;
 @PrePersist void create(){createdAt=LocalDateTime.now();}
}
