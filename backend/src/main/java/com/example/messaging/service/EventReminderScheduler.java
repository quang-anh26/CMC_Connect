package com.example.messaging.service;

import com.example.messaging.entity.EventParticipant;
import com.example.messaging.entity.SocialEvent;
import com.example.messaging.repository.SocialEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Mỗi phút quét các sự kiện sắp / đang diễn ra và gửi thông báo cho người tổ chức + người đã
 * bấm "Tham gia" / "Quan tâm":
 *  - EVENT_REMINDER: trước giờ bắt đầu {@value #REMINDER_MINUTES} phút.
 *  - EVENT_STARTED : khi tới giờ bắt đầu.
 * Mỗi người chỉ nhận mỗi loại một lần cho mỗi sự kiện (NotificationService.createSystem tự chống trùng).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EventReminderScheduler {

    private static final int REMINDER_MINUTES = 30;
    private static final int STARTED_GRACE_HOURS = 2;
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm 'ngày' dd/MM");

    private final SocialEventRepository eventRepository;
    private final NotificationService notificationService;

    @Scheduled(fixedDelay = 60_000, initialDelay = 20_000)
    public void sendEventNotifications() {
        LocalDateTime now = LocalDateTime.now();
        List<SocialEvent> events = eventRepository.findByCancelledFalseAndStartsAtBetween(
                now.minusHours(STARTED_GRACE_HOURS), now.plusMinutes(REMINDER_MINUTES));
        for (SocialEvent event : events) {
            try {
                notifyEvent(event, now);
            } catch (Exception ex) {
                log.warn("Không gửi được thông báo sự kiện {}: {}", event.getEventId(), ex.getMessage());
            }
        }
    }

    private void notifyEvent(SocialEvent event, LocalDateTime now) {
        boolean started = !event.getStartsAt().isAfter(now);
        String type = started ? "EVENT_STARTED" : "EVENT_REMINDER";
        String message = started
                ? "Sự kiện “" + event.getTitle() + "” đã bắt đầu tại " + event.getLocation() + "."
                : "Sự kiện “" + event.getTitle() + "” sắp bắt đầu lúc " + event.getStartsAt().format(TIME)
                    + " tại " + event.getLocation() + ".";

        Set<Long> recipients = new LinkedHashSet<>();
        recipients.add(event.getOrganizer().getUserId());
        for (EventParticipant participant : event.getParticipants()) {
            recipients.add(participant.getUser().getUserId());
        }
        for (Long userId : recipients) {
            notificationService.createSystem(userId, type, "EVENT", event.getEventId(), message);
        }
    }
}
