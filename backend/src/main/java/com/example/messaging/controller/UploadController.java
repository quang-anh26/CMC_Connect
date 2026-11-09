package com.example.messaging.controller;

import com.example.messaging.config.UploadDirectory;
import com.example.messaging.exception.ApiException;
import com.example.messaging.security.CurrentUser;
import com.example.messaging.service.GroupService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.CacheControl;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@RestController
@RequiredArgsConstructor
public class UploadController {
    private final UploadDirectory uploadDirectory;
    private final GroupService groupService;

    @GetMapping("/uploads/{fileName:.+}")
    public ResponseEntity<Resource> getUpload(@PathVariable String fileName,
                                              @CurrentUser Long userId) throws IOException {
        if (fileName.contains("/") || fileName.contains("\\") || fileName.contains("..")) {
            throw ApiException.notFound("Không tìm thấy tệp");
        }
        String mediaUrl = "/uploads/" + fileName;
        boolean privateMedia = groupService.authorizeStaticUpload(mediaUrl, userId);
        Path file = uploadDirectory.resolveLocations().stream()
                .map(directory -> directory.resolve(fileName).normalize())
                .filter(path -> Files.isRegularFile(path))
                .findFirst()
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy tệp"));
        Resource resource = new FileSystemResource(file);
        String contentType = Files.probeContentType(file);
        MediaType mediaType = contentType == null
                ? MediaType.APPLICATION_OCTET_STREAM
                : MediaType.parseMediaType(contentType);
        ResponseEntity.BodyBuilder response = ResponseEntity.ok().contentType(mediaType);
        if (privateMedia) response.cacheControl(CacheControl.noStore());
        return response.body(resource);
    }
}
