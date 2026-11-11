package com.example.messaging.service;

import com.example.messaging.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

/**
 * Theo dõi trạng thái "đang hoạt động" của người dùng bằng heartbeat.
 * Frontend gửi heartbeat định kỳ; người dùng được coi là online nếu heartbeat gần nhất
 * chưa quá {@link #ONLINE_WINDOW}. Trạng thái và thời điểm heartbeat được lưu trong cơ sở dữ liệu.
 */
@Service
@RequiredArgsConstructor
public class PresenceService {

    private static final Duration ONLINE_WINDOW = Duration.ofSeconds(75);
    private static final int MAX_IDS_PER_QUERY = 500;

    private final UserRepository userRepository;

    /**
     * @param active false nghĩa là người dùng đã tắt "Trạng thái hoạt động" -> hiện offline với bạn bè.
     */
    @Transactional
    public void heartbeat(Long userId, boolean active) {
        if (userId == null) return;
        userRepository.findById(userId).ifPresent(user -> {
            user.setOnline(active);
            user.setLastSeenAt(LocalDateTime.now());
        });
    }

    @Transactional
    public List<Long> filterOnline(Collection<Long> userIds) {
        LocalDateTime threshold = LocalDateTime.now().minus(ONLINE_WINDOW);
        expireInactiveUsers(threshold);
        List<Long> ids = userIds.stream()
                .filter(id -> id != null)
                .distinct()
                .limit(MAX_IDS_PER_QUERY)
                .toList();
        if (ids.isEmpty()) return List.of();
        return userRepository.findRecentlyOnlineIds(ids, threshold);
    }

    @Transactional
    public boolean isOnline(Long userId) {
        if (userId == null) return false;
        return !filterOnline(List.of(userId)).isEmpty();
    }

    @Scheduled(fixedDelay = 15000)
    @Transactional
    public void expireInactiveUsers() {
        expireInactiveUsers(LocalDateTime.now().minus(ONLINE_WINDOW));
    }

    private void expireInactiveUsers(LocalDateTime threshold) {
        userRepository.markInactiveUsersOffline(threshold);
    }
}
