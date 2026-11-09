package com.example.messaging.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

@Component
public class UploadDirectory {

    @Value("${app.upload.dir}")
    private String configuredDirectory;

    public Path resolve() {
        Path configuredPath = Paths.get(configuredDirectory);
        if (configuredPath.isAbsolute()) return configuredPath.normalize();

        Path workingDirectory = Paths.get("").toAbsolutePath().normalize();
        Path ancestor = workingDirectory;
        while (ancestor != null) {
            if (Files.exists(ancestor.resolve("backend").resolve("pom.xml"))) {
                return ancestor.resolve(configuredPath).normalize();
            }
            if (ancestor.getFileName() != null
                    && "backend".equalsIgnoreCase(ancestor.getFileName().toString())
                    && Files.exists(ancestor.resolve("pom.xml"))) {
                return ancestor.getParent().resolve(configuredPath).normalize();
            }
            ancestor = ancestor.getParent();
        }
        return workingDirectory.resolve(configuredPath).normalize();
    }

    public Path resolvePrivateGroup(Long groupId) {
        return resolve().toAbsolutePath().normalize().getParent()
                .resolve("private-group-files").resolve(groupId.toString()).normalize();
    }

    public List<Path> resolveLocations() {
        Path configuredPath = Paths.get(configuredDirectory);
        Path primary = resolve();
        if (configuredPath.isAbsolute()) return List.of(primary);

        Path ancestor = Paths.get("").toAbsolutePath().normalize();
        Path projectRoot = null;
        while (ancestor != null) {
            if (Files.exists(ancestor.resolve("backend").resolve("pom.xml"))) {
                projectRoot = ancestor;
                break;
            }
            if (ancestor.getFileName() != null
                    && "backend".equalsIgnoreCase(ancestor.getFileName().toString())
                    && Files.exists(ancestor.resolve("pom.xml"))) {
                projectRoot = ancestor.getParent();
                break;
            }
            ancestor = ancestor.getParent();
        }

        if (projectRoot == null) return List.of(primary);

        List<Path> locations = new ArrayList<>();
        addExistingDirectory(locations, primary);
        addExistingDirectory(locations, projectRoot.resolve("uploads"));
        addExistingDirectory(locations, projectRoot.resolve("backend").resolve("uploads"));
        return locations.isEmpty() ? List.of(primary) : locations;
    }

    private void addExistingDirectory(List<Path> locations, Path path) {
        Path normalized = path.normalize();
        if (Files.isDirectory(normalized) && !locations.contains(normalized)) {
            locations.add(normalized);
        }
    }
}
