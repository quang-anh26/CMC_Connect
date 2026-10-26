package com.example.messaging.service;

import com.example.messaging.dto.event.EventAttendeeResponse;
import com.example.messaging.dto.event.EventAttendanceRequest;
import com.example.messaging.dto.event.EventResponse;
import com.example.messaging.dto.event.EventUpsertRequest;
import com.example.messaging.entity.EventParticipant;
import com.example.messaging.entity.SocialEvent;
import com.example.messaging.entity.User;
import com.example.messaging.entity.enums.EventAttendanceStatus;
import com.example.messaging.entity.enums.EventPrivacy;
import com.example.messaging.entity.enums.FriendRequestStatus;
import com.example.messaging.exception.ApiException;
import com.example.messaging.repository.EventParticipantRepository;
import com.example.messaging.repository.FriendRequestRepository;
import com.example.messaging.repository.SocialEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class EventService {
    private final SocialEventRepository eventRepository;
    private final EventParticipantRepository participantRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final UserService userService;
    private final NotificationService notificationService;

    @Transactional(readOnly = true)
    public List<EventResponse> list(Long viewerId, String filter) {
        String selectedFilter = filter == null ? "ALL" : filter.trim().toUpperCase(Locale.ROOT);
        LocalDateTime now = LocalDateTime.now();
        return eventRepository.findByCancelledFalseOrderByStartsAtAsc().stream()
                .filter(event -> canView(event, viewerId))
                .filter(event -> switch (selectedFilter) {
                    case "UPCOMING" -> !event.getStartsAt().isBefore(now);
                    case "JOINED" -> hasStatus(event, viewerId, EventAttendanceStatus.GOING);
                    case "MINE" -> event.getOrganizer().getUserId().equals(viewerId);
                    case "ALL" -> true;
                    default -> throw ApiException.badRequest("Bộ lọc sự kiện không hợp lệ");
                })
                .map(event -> toResponse(event, viewerId))
                .toList();
    }

    @Transactional(readOnly = true)
    public EventResponse get(Long eventId, Long viewerId) {
        SocialEvent event = getEvent(eventId);
        if (!canView(event, viewerId)) {
            throw ApiException.notFound("Không tìm thấy sự kiện");
        }
        return toResponse(event, viewerId);
    }

    @Transactional
    public EventResponse create(Long organizerId, EventUpsertRequest request) {
        validateRequest(request, true);
        SocialEvent event = SocialEvent.builder()
                .organizer(userService.getByIdOrThrow(organizerId))
                .title(request.getTitle().trim())
                .imageUrl(clean(request.getImageUrl()))
                .startsAt(request.getStartsAt())
                .location(request.getLocation().trim())
                .description(clean(request.getDescription()))
                .privacy(parsePrivacy(request.getPrivacy()))
                .build();
        return toResponse(eventRepository.save(event), organizerId);
    }

    @Transactional
    public EventResponse update(Long eventId, Long requesterId, EventUpsertRequest request) {
        SocialEvent event = getEvent(eventId);
        requireOrganizer(event, requesterId);
        if (event.isCancelled()) throw ApiException.badRequest("Sự kiện đã bị hủy");
        validateRequest(request, false);
        event.setTitle(request.getTitle().trim());
        event.setImageUrl(clean(request.getImageUrl()));
        event.setStartsAt(request.getStartsAt());
        event.setLocation(request.getLocation().trim());
        event.setDescription(clean(request.getDescription()));
        event.setPrivacy(parsePrivacy(request.getPrivacy()));
        SocialEvent saved = eventRepository.save(event);
        participantRepository.findAttendees(eventId).forEach(participant ->
            notificationService.create(participant.getUser().getUserId(), requesterId, "EVENT_UPDATED", "EVENT", eventId,
                "đã cập nhật sự kiện “" + saved.getTitle() + "”."));
        return toResponse(saved, requesterId);
    }

    @Transactional
    public void cancel(Long eventId, Long requesterId) {
        SocialEvent event = getEvent(eventId);
        requireOrganizer(event, requesterId);
        event.setCancelled(true);
        eventRepository.save(event);
        participantRepository.findAttendees(eventId).forEach(participant ->
            notificationService.create(participant.getUser().getUserId(), requesterId, "EVENT_CANCELLED", "EVENT", eventId,
                "đã hủy sự kiện “" + event.getTitle() + "”."));
    }

    @Transactional
    public EventResponse setAttendance(Long eventId, Long userId, EventAttendanceRequest request) {
        SocialEvent event = getEvent(eventId);
        if (event.isCancelled()) throw ApiException.badRequest("Sự kiện đã bị hủy");
        if (event.getStartsAt().isBefore(LocalDateTime.now())) {
            throw ApiException.badRequest("Sự kiện này đã diễn ra");
        }
        if (!canView(event, userId)) throw ApiException.notFound("Không tìm thấy sự kiện");

        EventAttendanceStatus status;
        try {
            status = EventAttendanceStatus.valueOf(request.getStatus().trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw ApiException.badRequest("Trạng thái tham gia không hợp lệ");
        }

        var existing = participantRepository.findByEventEventIdAndUserUserId(eventId, userId);
        if (existing.isPresent() && existing.get().getStatus() == status) {
            participantRepository.delete(existing.get());
        } else {
            EventParticipant participant = existing.orElseGet(() -> EventParticipant.builder()
                    .event(event)
                    .user(userService.getByIdOrThrow(userId))
                    .build());
            participant.setStatus(status);
            participantRepository.save(participant);
            notificationService.create(event.getOrganizer().getUserId(), userId, "EVENT_ATTENDANCE", "EVENT", eventId,
                "đã phản hồi tham gia sự kiện “" + event.getTitle() + "”.");
        }
        return toResponse(event, userId);
    }

    private SocialEvent getEvent(Long eventId) {
        return eventRepository.findById(eventId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy sự kiện"));
    }

    private boolean hasStatus(SocialEvent event, Long userId, EventAttendanceStatus status) {
        return event.getParticipants().stream().anyMatch(p ->
                p.getUser().getUserId().equals(userId) && p.getStatus() == status);
    }

    private boolean canView(SocialEvent event, Long viewerId) {
        if (event.getOrganizer().getUserId().equals(viewerId) ||
                event.getParticipants().stream().anyMatch(p -> p.getUser().getUserId().equals(viewerId))) {
            return true;
        }
        return switch (event.getPrivacy()) {
            case PUBLIC -> true;
            case PRIVATE -> false;
            case FRIENDS -> friendRequestRepository.findRelationship(viewerId, event.getOrganizer().getUserId())
                    .stream().findFirst()
                    .map(relationship -> relationship.getStatus() == FriendRequestStatus.ACCEPTED)
                    .orElse(false);
        };
    }

    private void validateRequest(EventUpsertRequest request, boolean creating) {
        if (request.getStartsAt() == null) throw ApiException.badRequest("Vui lòng chọn ngày giờ sự kiện");
        if (creating && !request.getStartsAt().isAfter(LocalDateTime.now())) {
            throw ApiException.badRequest("Thời gian sự kiện phải ở trong tương lai");
        }
        if (request.getImageUrl() != null && request.getImageUrl().length() > 1000) {
            throw ApiException.badRequest("Đường dẫn ảnh quá dài");
        }
    }

    private EventPrivacy parsePrivacy(String value) {
        try {
            return EventPrivacy.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (RuntimeException ex) {
            throw ApiException.badRequest("Quyền riêng tư không hợp lệ");
        }
    }

    private void requireOrganizer(SocialEvent event, Long requesterId) {
        if (!event.getOrganizer().getUserId().equals(requesterId)) {
            throw ApiException.forbidden("Chỉ người tạo mới có thể chỉnh sửa sự kiện này");
        }
    }

    private String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private EventResponse toResponse(SocialEvent event, Long viewerId) {
        User organizer = event.getOrganizer();
        List<EventAttendeeResponse> attendees = participantRepository.findAttendees(event.getEventId()).stream()
                .map(participant -> EventAttendeeResponse.builder()
                        .userId(participant.getUser().getUserId())
                        .name(displayName(participant.getUser()))
                        .avatar(participant.getUser().getAvatar())
                        .status(participant.getStatus().name())
                        .build())
                .toList();
        String viewerStatus = attendees.stream()
                .filter(attendee -> attendee.getUserId().equals(viewerId))
                .map(EventAttendeeResponse::getStatus)
                .findFirst().orElse(null);
        long goingCount = attendees.stream().filter(a -> "GOING".equals(a.getStatus())).count();
        long interestedCount = attendees.stream().filter(a -> "INTERESTED".equals(a.getStatus())).count();
        return EventResponse.builder()
                .eventId(event.getEventId())
                .organizerId(organizer.getUserId())
                .organizerName(displayName(organizer))
                .organizerAvatar(organizer.getAvatar())
                .title(event.getTitle())
                .imageUrl(event.getImageUrl())
                .startsAt(event.getStartsAt())
                .location(event.getLocation())
                .description(event.getDescription())
                .privacy(event.getPrivacy().name())
                .createdAt(event.getCreatedAt())
                .goingCount(goingCount)
                .interestedCount(interestedCount)
                .viewerStatus(viewerStatus)
                .attendees(attendees)
                .build();
    }

    private String displayName(User user) {
        return user.getDisplayName() == null || user.getDisplayName().isBlank()
                ? user.getUsername() : user.getDisplayName();
    }
}
