package com.example.messaging.service;

import com.example.messaging.entity.Block;
import com.example.messaging.entity.User;
import com.example.messaging.exception.ApiException;
import com.example.messaging.repository.BlockRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BlockService {

    private final BlockRepository blockRepository;
    private final UserService userService;

    @Transactional
    public void block(Long blockerId, Long blockedId) {
        if (blockerId.equals(blockedId)) {
            throw ApiException.badRequest("Không thể tự chặn chính mình");
        }
        if (blockRepository.existsByBlockerUserIdAndBlockedUserId(blockerId, blockedId)) {
            return; // idempotent
        }
        User blocker = userService.getByIdOrThrow(blockerId);
        User blocked = userService.getByIdOrThrow(blockedId);

        blockRepository.save(Block.builder().blocker(blocker).blocked(blocked).build());
    }

    @Transactional
    public void unblock(Long blockerId, Long blockedId) {
        blockRepository.deleteByBlockerUserIdAndBlockedUserId(blockerId, blockedId);
    }

    public boolean isBlocked(Long blockerId, Long blockedId) {
        return blockRepository.existsByBlockerUserIdAndBlockedUserId(blockerId, blockedId);
    }

    public boolean canSendMessage(Long senderId, Long recipientId) {
        return !isBlocked(recipientId, senderId) && !isBlocked(senderId, recipientId);
    }

    public void assertCanSendMessage(Long senderId, Long recipientId) {
        if (!canSendMessage(senderId, recipientId)) {
            String message = isBlocked(recipientId, senderId)
                    ? "Bạn không thể nhắn tin vì người này đã chặn bạn"
                    : "Bạn cần bỏ chặn người này trước khi nhắn tin";
            throw ApiException.forbidden(message);
        }
    }
}
