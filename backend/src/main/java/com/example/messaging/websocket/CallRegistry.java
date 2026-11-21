package com.example.messaging.websocket;

import com.example.messaging.repository.ConversationMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Theo dõi các cuộc gọi đang diễn ra (lưu trong bộ nhớ):
 *  - Cuộc gọi NHÓM: ai đang ở trong cuộc gọi -> người bấm gọi sau sẽ được "tham gia" thay vì tạo cuộc gọi mới;
 *    khi đã từng có >= 2 người mà chỉ còn 1 người thì tự ngắt cuộc gọi.
 *  - Cuộc gọi 1-1: biết ai đang gọi với ai -> một bên mất kết nối/đóng tab thì báo "end" cho bên còn lại.
 */
@Component
@RequiredArgsConstructor
public class CallRegistry {

    private static class GroupCall {
        String callType;
        final Set<String> participants = new LinkedHashSet<>();
        boolean hadTwo;
    }

    private final SimpMessagingTemplate messagingTemplate;
    private final ConversationMemberRepository conversationMemberRepository;

    private final Map<Long, GroupCall> groupCalls = new HashMap<>();
    private final Map<String, String> privatePeers = new HashMap<>();

    /* ===================== NHÓM ===================== */

    /** Bắt đầu gọi nhóm. Trả về callType của cuộc gọi ĐANG DIỄN RA (để người gọi tham gia), hoặc null nếu đã tạo cuộc gọi mới. */
    public synchronized String ring(Long conversationId, String username, String callType) {
        GroupCall call = groupCalls.get(conversationId);
        if (call != null) {
            call.participants.remove(username); // phòng trạng thái cũ còn sót lại của chính người này
            if (!call.participants.isEmpty()) return call.callType;
        }
        GroupCall created = new GroupCall();
        created.callType = "video".equals(callType) ? "video" : "audio";
        created.participants.add(username);
        groupCalls.put(conversationId, created);
        return null;
    }

    /** Tham gia cuộc gọi. Trả về false nếu cuộc gọi không còn tồn tại. */
    public synchronized boolean join(Long conversationId, String username) {
        GroupCall call = groupCalls.get(conversationId);
        if (call == null) return false;
        call.participants.add(username);
        if (call.participants.size() >= 2) call.hadTwo = true;
        return true;
    }

    /** Rời cuộc gọi. Trả về true nếu cuộc gọi bị đóng (hết người, hoặc chỉ còn 1 người sau khi đã có >= 2 người). */
    public synchronized boolean leave(Long conversationId, String username) {
        GroupCall call = groupCalls.get(conversationId);
        if (call == null) return false;
        call.participants.remove(username);
        if (call.participants.isEmpty() || (call.hadTwo && call.participants.size() <= 1)) {
            groupCalls.remove(conversationId);
            return true;
        }
        return false;
    }

    /** Gửi "group-closed" cho mọi thành viên (trừ người vừa rời) để tắt chuông / tự ngắt người còn lại. */
    public void broadcastClosed(Long conversationId, String exceptUsername) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "group-closed");
        payload.put("group", true);
        payload.put("conversationId", conversationId);
        for (String member : conversationMemberRepository.findUsernamesByConversationId(conversationId)) {
            if (!member.equals(exceptUsername)) {
                messagingTemplate.convertAndSendToUser(member, "/queue/call", payload);
            }
        }
    }

    /* ===================== 1-1 ===================== */

    public synchronized void registerPrivate(String from, String to) {
        if (from == null || to == null || from.equals(to)) return;
        if (privatePeers.containsKey(from) || privatePeers.containsKey(to)) return; // một trong hai đang bận
        privatePeers.put(from, to);
        privatePeers.put(to, from);
    }

    public synchronized void unregisterPrivate(String from, String to) {
        if (to != null && to.equals(privatePeers.get(from))) {
            privatePeers.remove(from);
            privatePeers.remove(to);
        }
    }

    /* ===================== MẤT KẾT NỐI ===================== */

    /** Gọi khi một người dùng mất toàn bộ kết nối WebSocket (đóng tab, mất mạng...). */
    public void onUserDisconnected(String username) {
        String peer;
        synchronized (this) {
            peer = privatePeers.remove(username);
            if (peer != null) privatePeers.remove(peer);
        }
        if (peer != null) {
            Map<String, Object> end = new LinkedHashMap<>();
            end.put("type", "end");
            end.put("fromUsername", username);
            messagingTemplate.convertAndSendToUser(peer, "/queue/call", end);
        }

        List<Long> affected = new java.util.ArrayList<>();
        synchronized (this) {
            groupCalls.forEach((conversationId, call) -> {
                if (call.participants.contains(username)) affected.add(conversationId);
            });
        }
        for (Long conversationId : affected) {
            if (leave(conversationId, username)) {
                broadcastClosed(conversationId, username);
            } else {
                Map<String, Object> leaveSignal = new LinkedHashMap<>();
                leaveSignal.put("type", "group-leave");
                leaveSignal.put("group", true);
                leaveSignal.put("conversationId", conversationId);
                leaveSignal.put("fromUsername", username);
                for (String member : conversationMemberRepository.findUsernamesByConversationId(conversationId)) {
                    if (!member.equals(username)) {
                        messagingTemplate.convertAndSendToUser(member, "/queue/call", leaveSignal);
                    }
                }
            }
        }
    }
}