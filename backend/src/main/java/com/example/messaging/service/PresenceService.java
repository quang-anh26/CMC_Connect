package com.example.messaging.service;

import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Theo dõi trạng thái "đang hoạt động" của người dùng bằng heartbeat.
 * Frontend gửi heartbeat định kỳ; người dùng được coi là online nếu heartbeat gần nhất
 * chưa quá {@link #ONLINE_WINDOW}. Dữ liệu lưu trong bộ nhớ (đủ cho 1 instance backend).
 */
@Service
public class PresenceService {

    private static final Duration ONLINE_WINDOW = Duration.ofSeconds(75);
    private static final int MAX_IDS_PER_QUERY = 500;

    private final Map<Long, Long> lastSeenMillis = new ConcurrentHashMap<>();

    /**
     * @param active false nghĩa là người dùng đã tắt "Trạng thái hoạt động" -> hiện offline với bạn bè.
     */
    public void heartbeat(Long userId, boolean active) {
        if (userId == null) {
            return;
        }
        if (active) {
            lastSeenMillis.put(userId, System.currentTimeMillis());
        } else {
            lastSeenMillis.remove(userId);
        }
        purgeExpired();
    }

    public List<Long> filterOnline(Collection<Long> userIds) {
        long threshold = System.currentTimeMillis() - ONLINE_WINDOW.toMillis();
        return userIds.stream()
                .filter(id -> id != null)
                .distinct()
                .limit(MAX_IDS_PER_QUERY)
                .filter(id -> {
                    Long seen = lastSeenMillis.get(id);
                    return seen != null && seen >= threshold;
                })
                .toList();
    }

    private void purgeExpired() {
        long threshold = System.currentTimeMillis() - ONLINE_WINDOW.toMillis() * 4;
        lastSeenMillis.entrySet().removeIf(entry -> entry.getValue() < threshold);
    }
}
