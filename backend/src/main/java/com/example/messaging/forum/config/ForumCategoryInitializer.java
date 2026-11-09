package com.example.messaging.forum.config;

import com.example.messaging.forum.entity.ForumCategory;
import com.example.messaging.forum.entity.ForumFaculty;
import com.example.messaging.forum.entity.ForumMajor;
import com.example.messaging.forum.repository.ForumCategoryRepository;
import com.example.messaging.forum.repository.ForumFacultyRepository;
import com.example.messaging.forum.repository.ForumMajorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class ForumCategoryInitializer implements ApplicationRunner {
    private final ForumCategoryRepository categories;
    private final ForumFacultyRepository faculties;
    private final ForumMajorRepository majors;

    @Override
    public void run(ApplicationArguments args) {
        List<ForumCategory> defaults = List.of(
                category("Hỏi đáp học tập", "Giải đáp bài tập, kiến thức và phương pháp học."),
                category("Lập trình và công nghệ", "Trao đổi về lập trình, công cụ và xu hướng công nghệ."),
                category("Cơ sở dữ liệu", "Thiết kế, truy vấn và quản trị cơ sở dữ liệu."),
                category("Đồ án và bài tập lớn", "Tìm đồng đội, chia sẻ tiến độ và kinh nghiệm làm đồ án."),
                category("Chia sẻ tài liệu", "Tài liệu học tập có nguồn và thông tin môn học rõ ràng."),
                category("Kinh nghiệm học tập", "Phương pháp học, thực tập và phát triển kỹ năng."),
                category("Thảo luận chung", "Trao đổi các chủ đề học đường và cộng đồng."));

        for (ForumCategory category : defaults) {
            if (!categories.existsByNameIgnoreCase(category.getName())) {
                categories.save(category);
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
    }

    private record FacultySeed(String name, List<String> majors) {
    }

    private ForumCategory category(String name, String description) {
        ForumCategory category = new ForumCategory();
        category.setName(name);
        category.setDescription(description);
        return category;
    }
}
