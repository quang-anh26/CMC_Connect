package com.example.messaging.controller;

import com.example.messaging.dto.auth.ChangePasswordRequest;
import com.example.messaging.dto.user.UpdateProfileRequest;
import com.example.messaging.dto.user.UserProfileResponse;
import com.example.messaging.security.CurrentUser;
import com.example.messaging.service.FileStorageService;
import com.example.messaging.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final FileStorageService fileStorageService;

    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> me(@CurrentUser Long userId) {
        return ResponseEntity.ok(userService.getProfile(userId, userId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserProfileResponse> getById(@PathVariable("id") Long id,
                                                         @CurrentUser Long viewerId) {
        return ResponseEntity.ok(userService.getProfile(id, viewerId));
    }

    @PutMapping("/me")
    public ResponseEntity<UserProfileResponse> updateProfile(@CurrentUser Long userId,
                                                               @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(userService.updateProfile(userId, request));
    }

    @PostMapping("/me/password")
    public ResponseEntity<Void> changePassword(@CurrentUser Long userId,
                                                @Valid @RequestBody ChangePasswordRequest request) {
        userService.changePassword(userId, request);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/me/avatar", consumes = "multipart/form-data")
    public ResponseEntity<Map<String, String>> uploadAvatar(@CurrentUser Long userId,
                                                              @RequestParam("file") MultipartFile file) {
        String url = fileStorageService.store(file);
        userService.updateProfile(userId, new UpdateProfileRequest() {{
            setAvatar(url);
        }});
        return ResponseEntity.ok(Map.of("url", url));
    }

    @PostMapping(value = "/me/cover", consumes = "multipart/form-data")
    public ResponseEntity<Map<String, String>> uploadCover(@CurrentUser Long userId,
                                                             @RequestParam("file") MultipartFile file) {
        String url = fileStorageService.store(file);
        userService.updateProfile(userId, new UpdateProfileRequest() {{
            setCoverImage(url);
        }});
        return ResponseEntity.ok(Map.of("url", url));
    }

    @GetMapping("/search")
    public ResponseEntity<List<UserProfileResponse>> search(@CurrentUser Long userId,
                                                              @RequestParam("q") String keyword) {
        return ResponseEntity.ok(userService.search(keyword, userId));
    }
}
