package com.example.messaging.forum.entity;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
@Entity @Table(name="forum_categories") @Getter @Setter @NoArgsConstructor
public class ForumCategory {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(nullable=false,unique=true,length=100) private String name;
 @Column(length=500) private String description;
 @Column(nullable=false) private boolean active=true;
 private LocalDateTime createdAt;
 @PrePersist void create(){createdAt=LocalDateTime.now();}
}
