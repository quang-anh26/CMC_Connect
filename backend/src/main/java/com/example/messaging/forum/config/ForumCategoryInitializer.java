package com.example.messaging.forum.config;

import com.example.messaging.forum.entity.ForumCategory;
import com.example.messaging.forum.entity.ForumCourse;
import com.example.messaging.forum.entity.ForumFaculty;
import com.example.messaging.forum.entity.ForumMajor;
import com.example.messaging.forum.repository.ForumCategoryRepository;
import com.example.messaging.forum.repository.ForumCourseRepository;
import com.example.messaging.forum.repository.ForumFacultyRepository;
import com.example.messaging.forum.repository.ForumMajorRepository;
import com.example.messaging.forum.repository.ForumTopicRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class ForumCategoryInitializer implements ApplicationRunner {
    private final ForumCategoryRepository categories;
    private final ForumCourseRepository courses;
    private final ForumFacultyRepository faculties;
    private final ForumMajorRepository majors;
    private final ForumTopicRepository topics;

    @Override
    public void run(ApplicationArguments args) {
        List<CategorySeed> defaults = List.of(
                new CategorySeed("Hỏi đáp & giải đáp",
                        "Đặt câu hỏi cần giải thích hoặc hỗ trợ, như lỗi Java hay cách giải bài tập.",
                        "QUESTION", List.of("Hỏi đáp học tập")),
                new CategorySeed("Chia sẻ tài liệu",
                        "Cung cấp tài liệu để tải về hoặc tham khảo: slide, đề thi, giáo trình, tài liệu ôn tập.",
                        "RESOURCE", List.of()),
                new CategorySeed("Đồ án & tìm nhóm",
                        "Tìm đồng đội, giới thiệu sản phẩm hoặc xin góp ý cho đồ án.",
                        "PROJECT", List.of("Đồ án và bài tập lớn")),
                new CategorySeed("Kinh nghiệm & chia sẻ",
                        "Chia sẻ trải nghiệm, phương pháp học tập và lời khuyên cho sinh viên.",
                        "EXPERIENCE", List.of("Kinh nghiệm học tập")));

        var categoriesByType = new java.util.HashMap<String, ForumCategory>();
        for (CategorySeed seed : defaults) {
            ForumCategory category = categories.findByNameIgnoreCase(seed.name()).orElse(null);
            if (category == null) {
                category = seed.legacyNames().stream()
                        .map(name -> categories.findByNameIgnoreCase(name).orElse(null))
                        .filter(existing -> existing != null)
                        .findFirst()
                        .orElseGet(ForumCategory::new);
            }
            category.setName(seed.name());
            category.setDescription(seed.description());
            category.setPostType(seed.postType());
            category.setActive(true);
            categoriesByType.put(seed.postType(), categories.save(category));
        }

        Set<String> activeCategoryNames = defaults.stream()
                .map(CategorySeed::name)
                .collect(Collectors.toSet());
        for (ForumCategory category : categories.findAll()) {
            if (category.isActive() && !activeCategoryNames.contains(category.getName())) {
                category.setActive(false);
                categories.save(category);
            }
        }

        for (var topic : topics.findAll()) {
            String categoryType = switch (topic.getType()) {
                case "RESOURCE" -> "RESOURCE";
                case "PROJECT" -> "PROJECT";
                case "EXPERIENCE", "DISCUSSION", "KNOWLEDGE" -> "EXPERIENCE";
                default -> "QUESTION";
            };
            ForumCategory category = categoriesByType.get(categoryType);
            Long existingCategoryId = topic.getCategory() == null ? null : topic.getCategory().getId();
            if (!category.getId().equals(existingCategoryId)) {
                topic.setCategory(category);
                topics.save(topic);
            }
        }

        List<FacultySeed> academicFaculties = List.of(
                new FacultySeed("KHOA CÔNG NGHỆ THÔNG TIN & TRUYỀN THÔNG",
                        List.of("Công nghệ Thông tin", "Khoa học Máy tính", "Trí tuệ Nhân tạo",
                                "Kỹ thuật Phần mềm", "An ninh mạng")),
                new FacultySeed("KHOA KINH DOANH & QUẢN LÝ",
                        List.of("Quản trị Kinh doanh", "Digital Marketing",
                                "Logistics và Quản lý Chuỗi cung ứng", "Thương mại điện tử",
                                "Kinh doanh Quốc tế")),
                new FacultySeed("KHOA VI ĐIỆN TỬ & VIỄN THÔNG",
                        List.of("Công nghệ kỹ thuật Điện tử – Viễn thông")),
                new FacultySeed("KHOA MỸ THUẬT & THIẾT KẾ",
                        List.of("Thiết kế Đồ họa", "Đồ họa game", "Thiết kế Mỹ thuật số")),
                new FacultySeed("KHOA NGÔN NGỮ",
                        List.of("Ngôn ngữ Hàn Quốc", "Ngôn ngữ Trung Quốc", "Tiếng Trung Thương mại")),
                new FacultySeed("KHOA TRUYỀN THÔNG ĐA PHƯƠNG TIỆN",
                        List.of("Truyền thông đa phương tiện", "Quan hệ Công chúng")),
                new FacultySeed("CHƯƠNG TRÌNH TIẾNG ANH", List.of()));

        for (FacultySeed seed : academicFaculties) {
            ForumFaculty faculty = faculties.findByNameIgnoreCase(seed.name())
                    .orElseGet(() -> {
                        ForumFaculty created = new ForumFaculty();
                        created.setName(seed.name());
                        return faculties.save(created);
                    });
            for (String majorName : seed.majors()) {
                if (!majors.existsByFacultyIdAndNameIgnoreCase(faculty.getId(), majorName)) {
                    ForumMajor major = new ForumMajor();
                    major.setFaculty(faculty);
                    major.setName(majorName);
                    majors.save(major);
                }
            }
        }

        ForumFaculty itFaculty = faculties.findByNameIgnoreCase("KHOA CÔNG NGHỆ THÔNG TIN & TRUYỀN THÔNG")
                .orElseThrow();
        List<String> itCourses = List.of(
                "Đồ án chuyên ngành",
                "Điện toán đám mây",
                "Học máy và khai phá dữ liệu",
                "Công nghệ lập trình web",
                "Công nghệ phần mềm");
        for (String courseName : itCourses) {
            ForumCourse course = courses.findFirstByNameIgnoreCase(courseName)
                    .orElseGet(ForumCourse::new);
            if (course.getId() == null) course.setCode("");
            course.setName(courseName);
            course.setFaculty(itFaculty);
            course.setActive(true);
            courses.save(course);
        }
    }

    private record FacultySeed(String name, List<String> majors) {
    }

    private record CategorySeed(String name, String description, String postType, List<String> legacyNames) {
    }
}
