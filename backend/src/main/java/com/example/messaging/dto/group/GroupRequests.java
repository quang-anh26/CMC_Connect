package com.example.messaging.dto.group;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.List;

public final class GroupRequests {
    private GroupRequests() {}

    public record CreateGroup(
            @NotBlank @Size(max = 100) String name,
            @Size(max = 2000) String description,
            @Size(max = 500) String avatar,
            @Size(max = 500) String coverImage,
            @Size(max = 80) String category,
            @Size(max = 20) String visibility) {}

    public record UpdateGroup(
            @Size(max = 100) String name,
            @Size(max = 2000) String description,
            @Size(max = 500) String avatar,
            @Size(max = 500) String coverImage,
            @Size(max = 80) String category,
            @Size(max = 20) String visibility,
            Boolean postApprovalRequired,
            @Size(max = 2000) String spamKeywords) {}

    public record CreatePost(
            @Size(max = 10000) String content,
            @Size(max = 1000) String mediaUrl,
            @Size(max = 20) String mediaType) {}

    public record CreateComment(
            @NotBlank @Size(max = 2000) String content,
            Long parentCommentId) {}

    public record RoleChange(@NotBlank String role) {}
    public record MemberAction(@Size(max = 500) String reason) {}
    public record JoinDecision(@NotNull Boolean approved) {}

    public record Report(
            @NotBlank @Size(max = 20) String targetType,
            @NotNull Long targetId,
            @NotBlank @Size(max = 500) String reason) {}

    public record Invite(@NotNull Long userId) {}
    public record ReportDecision(@NotNull Boolean removeContent) {}

    public record CreatePoll(
            @NotBlank @Size(max = 10000) String question,
            @NotNull @Size(min = 2, max = 10) List<@NotBlank @Size(max = 120) String> options,
            LocalDateTime endsAt) {}

    public record PollVote(@NotNull Long optionId) {}

    public record CreateEvent(
            @NotBlank @Size(max = 120) String title,
            @Size(max = 2000) String description,
            @Size(max = 200) String location,
            @NotNull LocalDateTime startsAt,
            LocalDateTime endsAt) {}
}