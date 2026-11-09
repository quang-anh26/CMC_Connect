package com.example.messaging.controller;

import com.example.messaging.security.CurrentUser;
import com.example.messaging.service.PresenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/presence")
@RequiredArgsConstructor
public class PresenceController {

    private final PresenceService presenceService;

    /** Frontend gọi định kỳ để báo "tôi đang online". Body: { "active": true|false } */
    @PostMapping("/heartbeat")
    public ResponseEntity<Void> heartbeat(@CurrentUser Long userId,
                                          @RequestBody(required = false) Map<String, Object> body) {
        boolean active = body == null || !Boolean.FALSE.equals(body.get("active"));
        presenceService.heartbeat(userId, active);
        return ResponseEntity.noContent().build();
    }

    /** GET /api/presence/online?ids=1,2,3 -> { "onlineIds": [1,3] } */
    @GetMapping("/online")
    public ResponseEntity<Map<String, List<Long>>> online(@RequestParam(defaultValue = "") String ids) {
        List<Long> requested = new ArrayList<>();
        for (String part : ids.split(",")) {
            String trimmed = part.trim();
            if (trimmed.isEmpty()) continue;
            try {
                requested.add(Long.parseLong(trimmed));
            } catch (NumberFormatException ignored) {
                // bỏ qua id không hợp lệ
            }
        }
        return ResponseEntity.ok(Map.of("onlineIds", presenceService.filterOnline(requested)));
    }
}
