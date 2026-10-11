package com.example.messaging.controller;

import com.example.messaging.dto.group.GroupRequests;
import com.example.messaging.security.CurrentUser;
import com.example.messaging.service.FileStorageService;
import com.example.messaging.service.GroupService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupController {
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "jpg", "jpeg", "png", "gif", "webp", "mp4", "webm", "mov", "pdf", "txt", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "zip");

    private final GroupService groupService;
    private final FileStorageService fileStorageService;

    @GetMapping
    public ResponseEntity<?> list(@CurrentUser Long userId,
                                  @RequestParam(required = false) String search,
                                  @RequestParam(defaultValue = "false") boolean mine) {
        return ResponseEntity.ok(groupService.listGroups(userId, search, mine));
    }

    @PostMapping
    public ResponseEntity<?> create(@CurrentUser Long userId, @Valid @RequestBody GroupRequests.CreateGroup request) {
        return ResponseEntity.ok(groupService.createGroup(userId, request));
    }

    @GetMapping("/{groupId}")
    public ResponseEntity<?> get(@PathVariable Long groupId, @CurrentUser Long userId) {
        return ResponseEntity.ok(groupService.getGroup(groupId, userId));
    }

    @PutMapping("/{groupId}")
    public ResponseEntity<?> update(@PathVariable Long groupId, @CurrentUser Long userId,
                                    @Valid @RequestBody GroupRequests.UpdateGroup request) {
        return ResponseEntity.ok(groupService.updateGroup(groupId, userId, request));
    }

    @DeleteMapping("/{groupId}")
    public ResponseEntity<Void> delete(@PathVariable Long groupId, @CurrentUser Long userId) {
        groupService.deleteGroup(groupId, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{groupId}/join")
    public ResponseEntity<?> join(@PathVariable Long groupId, @CurrentUser Long userId) {
        return ResponseEntity.ok(groupService.joinGroup(groupId, userId));
    }

    @DeleteMapping("/{groupId}/membership")
    public ResponseEntity<Void> leave(@PathVariable Long groupId, @CurrentUser Long userId) {
        groupService.leaveGroup(groupId, userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{groupId}/members")
    public ResponseEntity<?> members(@PathVariable Long groupId, @CurrentUser Long userId) {
        return ResponseEntity.ok(groupService.listMembers(groupId, userId));
    }

    @GetMapping("/{groupId}/posts")
    public ResponseEntity<?> posts(@PathVariable Long groupId, @CurrentUser Long userId,
                                   @RequestParam(required = false) String search,
                                   @RequestParam(defaultValue = "NEWEST") String sort,
                                   @RequestParam(defaultValue = "false") boolean mediaOnly) {
        return ResponseEntity.ok(groupService.listPosts(groupId, userId, search, sort, mediaOnly));
    }

    @PostMapping("/{groupId}/posts")
    public ResponseEntity<?> createPost(@PathVariable Long groupId, @CurrentUser Long userId,
                                        @Valid @RequestBody GroupRequests.CreatePost request) {
        return ResponseEntity.ok(groupService.createPost(groupId, userId, request));
    }

    @PutMapping("/{groupId}/posts/{postId}")
    public ResponseEntity<?> updatePost(@PathVariable Long groupId, @PathVariable Long postId, @CurrentUser Long userId,
                                        @Valid @RequestBody GroupRequests.CreatePost request) {
        return ResponseEntity.ok(groupService.updatePost(groupId, postId, userId, request));
    }

    @DeleteMapping("/{groupId}/posts/{postId}")
    public ResponseEntity<Void> deletePost(@PathVariable Long groupId, @PathVariable Long postId, @CurrentUser Long userId) {
        groupService.deletePost(groupId, postId, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{groupId}/posts/{postId}/reactions")
    public ResponseEntity<?> react(@PathVariable Long groupId, @PathVariable Long postId, @CurrentUser Long userId,
                                   @RequestParam(defaultValue = "LIKE") String type) {
        return ResponseEntity.ok(groupService.toggleReaction(groupId, postId, userId, type));
    }

    @PostMapping("/{groupId}/polls")
    public ResponseEntity<?> createPoll(@PathVariable Long groupId, @CurrentUser Long userId,
                                        @Valid @RequestBody GroupRequests.CreatePoll request) {
        return ResponseEntity.ok(groupService.createPoll(groupId, userId, request));
    }

    @PostMapping("/{groupId}/posts/{postId}/poll-votes")
    public ResponseEntity<?> votePoll(@PathVariable Long groupId, @PathVariable Long postId, @CurrentUser Long userId,
                                      @Valid @RequestBody GroupRequests.PollVote request) {
        return ResponseEntity.ok(groupService.votePoll(groupId, postId, userId, request.optionId()));
    }

    @GetMapping("/{groupId}/events")
    public ResponseEntity<?> events(@PathVariable Long groupId, @CurrentUser Long userId) {
        return ResponseEntity.ok(groupService.listEvents(groupId, userId));
    }

    @PostMapping("/{groupId}/events")
    public ResponseEntity<?> createEvent(@PathVariable Long groupId, @CurrentUser Long userId,
                                         @Valid @RequestBody GroupRequests.CreateEvent request) {
        return ResponseEntity.ok(groupService.createEvent(groupId, userId, request));
    }

    @PostMapping("/{groupId}/events/{eventId}/participation")
    public ResponseEntity<?> toggleEventParticipation(@PathVariable Long groupId, @PathVariable Long eventId,
                                                      @CurrentUser Long userId) {
        return ResponseEntity.ok(groupService.toggleEventParticipation(groupId, eventId, userId));
    }

    @PostMapping("/{groupId}/posts/{postId}/comments")
    public ResponseEntity<?> comment(@PathVariable Long groupId, @PathVariable Long postId, @CurrentUser Long userId,
                                     @Valid @RequestBody GroupRequests.CreateComment request) {
        return ResponseEntity.ok(groupService.addComment(groupId, postId, userId, request));
    }

    @DeleteMapping("/{groupId}/comments/{commentId}")
    public ResponseEntity<Void> deleteComment(@PathVariable Long groupId, @PathVariable Long commentId, @CurrentUser Long userId) {
        groupService.deleteComment(groupId, commentId, userId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{groupId}/posts/{postId}/pin")
    public ResponseEntity<Void> pin(@PathVariable Long groupId, @PathVariable Long postId, @CurrentUser Long userId) {
        groupService.togglePin(groupId, postId, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{groupId}/reports")
    public ResponseEntity<Void> report(@PathVariable Long groupId, @CurrentUser Long userId,
                                       @Valid @RequestBody GroupRequests.Report request) {
        groupService.report(groupId, userId, request);
        return ResponseEntity.accepted().build();
    }

    @GetMapping("/{groupId}/join-requests")
    public ResponseEntity<?> joinRequests(@PathVariable Long groupId, @CurrentUser Long userId) {
        return ResponseEntity.ok(groupService.joinRequests(groupId, userId));
    }

    @PatchMapping("/{groupId}/join-requests/{requestId}")
    public ResponseEntity<Void> decideJoin(@PathVariable Long groupId, @PathVariable Long requestId, @CurrentUser Long userId,
                                           @Valid @RequestBody GroupRequests.JoinDecision request) {
        groupService.decideJoinRequest(groupId, requestId, userId, request.approved());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{groupId}/posts/pending")
    public ResponseEntity<?> pendingPosts(@PathVariable Long groupId, @CurrentUser Long userId) {
        return ResponseEntity.ok(groupService.pendingPosts(groupId, userId));
    }

    @PatchMapping("/{groupId}/posts/{postId}/review")
    public ResponseEntity<Void> reviewPost(@PathVariable Long groupId, @PathVariable Long postId, @CurrentUser Long userId,
                                           @Valid @RequestBody GroupRequests.JoinDecision request) {
        groupService.decidePost(groupId, postId, userId, request.approved());
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{groupId}/members/{memberId}/role")
    public ResponseEntity<Void> role(@PathVariable Long groupId, @PathVariable Long memberId, @CurrentUser Long userId,
                                     @Valid @RequestBody GroupRequests.RoleChange request) {
        groupService.changeRole(groupId, memberId, userId, request.role());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{groupId}/members/{memberId}")
    public ResponseEntity<Void> removeMember(@PathVariable Long groupId, @PathVariable Long memberId, @CurrentUser Long userId) {
        groupService.removeMember(groupId, memberId, userId, false, null);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{groupId}/members/{memberId}/ban")
    public ResponseEntity<Void> banMember(@PathVariable Long groupId, @PathVariable Long memberId, @CurrentUser Long userId,
                                          @RequestBody(required = false) GroupRequests.MemberAction request) {
        groupService.removeMember(groupId, memberId, userId, true, request == null ? null : request.reason());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{groupId}/bans/{memberId}")
    public ResponseEntity<Void> unbanMember(@PathVariable Long groupId, @PathVariable Long memberId, @CurrentUser Long userId) {
        groupService.unban(groupId, memberId, userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{groupId}/bans")
    public ResponseEntity<?> bans(@PathVariable Long groupId, @CurrentUser Long userId) {
        return ResponseEntity.ok(groupService.listBans(groupId, userId));
    }

    @PostMapping("/{groupId}/members/{memberId}/warning")
    public ResponseEntity<Void> warnMember(@PathVariable Long groupId, @PathVariable Long memberId, @CurrentUser Long userId,
                                           @Valid @RequestBody GroupRequests.MemberAction request) {
        groupService.warnMember(groupId, memberId, userId, request.reason());
        return ResponseEntity.accepted().build();
    }

    @GetMapping("/{groupId}/reports")
    public ResponseEntity<?> reports(@PathVariable Long groupId, @CurrentUser Long userId) {
        return ResponseEntity.ok(groupService.reports(groupId, userId));
    }

    @PatchMapping("/{groupId}/reports/{reportId}")
    public ResponseEntity<Void> decideReport(@PathVariable Long groupId, @PathVariable Long reportId, @CurrentUser Long userId,
                                             @Valid @RequestBody GroupRequests.ReportDecision request) {
        groupService.decideReport(groupId, reportId, userId, request.removeContent());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{groupId}/invites")
    public ResponseEntity<Void> invite(@PathVariable Long groupId, @CurrentUser Long userId,
                                       @Valid @RequestBody GroupRequests.Invite request) {
        groupService.invite(groupId, userId, request.userId());
        return ResponseEntity.accepted().build();
    }

    @PostMapping(value = "/{groupId}/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> upload(@PathVariable Long groupId, @CurrentUser Long userId,
                                    @RequestParam("file") MultipartFile file,
                                    @RequestParam(defaultValue = "POST") String purpose) {
        boolean groupImage = "GROUP_IMAGE".equalsIgnoreCase(purpose);
        if (!groupImage && !"POST".equalsIgnoreCase(purpose)) return ResponseEntity.badRequest().body(Map.of("message", "Mục đích tải lên không hợp lệ"));
        groupService.authorizeUpload(groupId, userId, groupImage);
        if (file.getOriginalFilename() == null || !file.getOriginalFilename().contains(".")) {
            return ResponseEntity.badRequest().body(Map.of("message", "Định dạng tệp không hợp lệ"));
        }
        String extension = file.getOriginalFilename().substring(file.getOriginalFilename().lastIndexOf('.') + 1).toLowerCase();
        if (!ALLOWED_EXTENSIONS.contains(extension)) return ResponseEntity.badRequest().body(Map.of("message", "Loại tệp không được hỗ trợ"));
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
        if (!(contentType.startsWith("image/") || contentType.startsWith("video/") || contentType.equals("application/pdf")
                || contentType.startsWith("text/") || contentType.contains("officedocument") || contentType.equals("application/zip")
                || contentType.equals("application/msword") || contentType.equals("application/vnd.ms-powerpoint")
                || contentType.equals("application/vnd.ms-excel"))) {
            return ResponseEntity.badRequest().body(Map.of("message", "MIME type không được hỗ trợ"));
        }
        String mediaType = contentType.startsWith("image/") ? "IMAGE" : contentType.startsWith("video/") ? "VIDEO" : "FILE";
        return ResponseEntity.ok(Map.of("url", fileStorageService.store(file), "mediaType", mediaType));
    }

    @GetMapping("/notifications")
    public ResponseEntity<?> notifications(@CurrentUser Long userId) {
        return ResponseEntity.ok(groupService.notifications(userId));
    }

    @PostMapping("/notifications/{notificationId}/read")
    public ResponseEntity<Void> markNotificationRead(@PathVariable Long notificationId, @CurrentUser Long userId) {
        groupService.markNotificationRead(notificationId, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/invites/{inviteId}/response")
    public ResponseEntity<Void> respondInvite(@PathVariable Long inviteId, @CurrentUser Long userId,
                                              @Valid @RequestBody GroupRequests.JoinDecision request) {
        groupService.respondInvite(inviteId, userId, request.approved());
        return ResponseEntity.noContent().build();
    }
}