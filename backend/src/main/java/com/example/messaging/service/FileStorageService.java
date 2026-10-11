package com.example.messaging.service;

import com.example.messaging.exception.ApiException;
import com.example.messaging.config.UploadDirectory;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

/**
 * Local server-storage implementation for images/files (plan section 2:
 * "File storage: Server hoặc Cloudinary cho hình ảnh; giới hạn file tối đa 10MB").
 * Swap this out for a CloudinaryStorageService implementing the same contract
 * if you want to store on Cloudinary instead - controllers/services depend only
 * on the returned public URL.
 */
@Service
@RequiredArgsConstructor
public class FileStorageService {

    private final UploadDirectory uploadDirectory;

    @Value("${app.upload.max-file-size-mb}")
    private long maxFileSizeMb;

    public String store(MultipartFile file) {
        return store(file, maxFileSizeMb);
    }

    public String store(MultipartFile file, long fileLimitMb) {
        if (file.isEmpty()) {
            throw ApiException.badRequest("File rỗng");
        }
        if (fileLimitMb <= 0 || file.getSize() > fileLimitMb * 1024 * 1024) {
            throw ApiException.badRequest("File vượt quá giới hạn " + fileLimitMb + "MB");
        }

        try {
            Path dir = uploadDirectory.resolve();
            Files.createDirectories(dir);

            String original = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
            String ext = original.contains(".") ? original.substring(original.lastIndexOf('.')) : "";
            String storedName = UUID.randomUUID() + ext;

            Path target = dir.resolve(storedName);
            Files.copy(file.getInputStream(), target);

            return "/uploads/" + storedName;
        } catch (IOException e) {
            throw new RuntimeException("Không thể lưu file: " + e.getMessage(), e);
        }
    }
}
