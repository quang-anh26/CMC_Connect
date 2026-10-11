package com.example.messaging.service;

import com.example.messaging.dto.marketplace.MarketplaceListingResponse;
import com.example.messaging.dto.marketplace.MarketplaceReportRequest;
import com.example.messaging.dto.marketplace.MarketplaceUpsertRequest;
import com.example.messaging.entity.*;
import com.example.messaging.exception.ApiException;
import com.example.messaging.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class MarketplaceService {
    private static final Set<String> CATEGORIES = Set.of(
            "Điện thoại", "Thời trang", "Điện tử", "Đồ gia dụng", "Xe", "Đồ cá nhân", "Khác");
    private static final Set<String> CONDITIONS = Set.of("NEW", "LIKE_NEW", "GOOD", "FAIR");
    private static final Set<String> IMAGE_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp", "gif");
    private static final int MAX_IMAGES = 8;

    private final MarketplaceListingRepository listingRepository;
    private final MarketplaceSavedRepository savedRepository;
    private final MarketplaceSellerFollowRepository followRepository;
    private final MarketplaceReportRepository reportRepository;
    private final MarketplaceSearchHistoryRepository searchHistoryRepository;
    private final SavedItemRepository savedItemRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;
    private final SavedService savedService;

    @Transactional
    public Page<MarketplaceListingResponse> search(Long userId, String keyword, String category, String condition,
                                                    BigDecimal minPrice, BigDecimal maxPrice, String location,
                                                    String sort, String scope, String status, Long sellerId,
                                                    int page, int size) {
        String normalizedKeyword = normalize(keyword, 160);
        if (!normalizedKeyword.isBlank()) {
            searchHistoryRepository.save(MarketplaceSearchHistory.builder()
                    .user(requireUser(userId))
                    .keyword(normalizedKeyword)
                    .build());
        }
        if (minPrice != null && minPrice.signum() < 0 || maxPrice != null && maxPrice.signum() < 0) {
            throw ApiException.badRequest("Khoảng giá không hợp lệ");
        }
        if (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0) {
            throw ApiException.badRequest("Giá tối thiểu không được lớn hơn giá tối đa");
        }

        String normalizedScope = normalizeScope(scope);
        String normalizedCondition = normalizeConditionFilter(condition);
        String normalizedStatus = "SOLD".equalsIgnoreCase(status) ? "SOLD" : "";
        String orderBy = switch (sort == null ? "" : sort.trim().toUpperCase(Locale.ROOT)) {
            case "PRICE_ASC" -> "price";
            case "PRICE_DESC" -> "price";
            case "POPULAR" -> "viewCount";
            default -> "createdAt";
        };
        Sort.Direction direction = "PRICE_ASC".equalsIgnoreCase(sort) ? Sort.Direction.ASC : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 40)),
                Sort.by(direction, orderBy).and(Sort.by(Sort.Direction.DESC, "listingId")));
        return listingRepository.search(userId, normalizedScope, normalizedStatus, normalizedKeyword,
                        normalize(category, 50), normalizedCondition, minPrice, maxPrice,
                        normalize(location, 160), sellerId, pageable)
                .map(listing -> toResponse(listing, userId));
    }

    @Transactional(readOnly = true)
    public MarketplaceListingResponse get(Long listingId, Long viewerId) {
        MarketplaceListing listing = readableListing(listingId, viewerId);
        return toResponse(listing, viewerId);
    }

    @Transactional
    public MarketplaceListingResponse view(Long listingId, Long viewerId) {
        MarketplaceListing listing = readableListing(listingId, viewerId);
        listing.setViewCount(listing.getViewCount() + 1);
        return toResponse(listing, viewerId);
    }

    @Transactional
    public MarketplaceListingResponse create(Long sellerId, MarketplaceUpsertRequest request) {
        User seller = requireUser(sellerId);
        validate(request);
        MarketplaceListing listing = MarketplaceListing.builder()
                .seller(seller)
                .title(request.title().trim())
                .description(request.description().trim())
                .price(request.price())
                .category(request.category().trim())
                .condition(request.condition().trim().toUpperCase(Locale.ROOT))
                .location(request.location().trim())
                .status("ACTIVE")
                .build();
        updateImages(listing, request.imageUrls());
        return toResponse(listingRepository.save(listing), sellerId);
    }

    @Transactional
    public MarketplaceListingResponse update(Long listingId, Long sellerId, MarketplaceUpsertRequest request) {
        MarketplaceListing listing = requireOwner(listingId, sellerId);
        if ("SOLD".equals(listing.getStatus())) throw ApiException.badRequest("Không thể chỉnh sửa sản phẩm đã bán");
        validate(request);
        listing.setTitle(request.title().trim());
        listing.setDescription(request.description().trim());
        listing.setPrice(request.price());
        listing.setCategory(request.category().trim());
        listing.setCondition(request.condition().trim().toUpperCase(Locale.ROOT));
        listing.setLocation(request.location().trim());
        listing.getImages().clear();
        updateImages(listing, request.imageUrls());
        return toResponse(listingRepository.save(listing), sellerId);
    }

    @Transactional
    public void delete(Long listingId, Long sellerId) {
        MarketplaceListing listing = requireOwner(listingId, sellerId);
        savedRepository.deleteByListingListingId(listingId);
        savedItemRepository.deleteByContentTypeAndContentId("MARKETPLACE", listingId);
        reportRepository.deleteByListingListingId(listingId);
        listingRepository.delete(listing);
    }

    @Transactional
    public MarketplaceListingResponse markSold(Long listingId, Long sellerId) {
        MarketplaceListing listing = requireOwner(listingId, sellerId);
        listing.setStatus("SOLD");
        return toResponse(listing, sellerId);
    }

    @Transactional
    public boolean toggleSaved(Long listingId, Long userId) {
        return Boolean.TRUE.equals(savedService.toggle(userId,
                new com.example.messaging.dto.saved.SaveItemRequest("MARKETPLACE", listingId, null)).get("saved"));
    }

    @Transactional
    public boolean toggleFollow(Long sellerId, Long followerId) {
        User seller = requireUser(sellerId);
        User follower = requireUser(followerId);
        if (sellerId.equals(followerId)) throw ApiException.badRequest("Bạn không thể theo dõi chính mình");
        return followRepository.findBySellerUserIdAndFollowerUserId(sellerId, followerId).map(follow -> {
            followRepository.delete(follow);
            return false;
        }).orElseGet(() -> {
            followRepository.save(MarketplaceSellerFollow.builder().seller(seller).follower(follower).build());
            return true;
        });
    }

    @Transactional
    public long share(Long listingId, Long userId) {
        MarketplaceListing listing = readableListing(listingId, userId);
        listing.setShareCount(listing.getShareCount() + 1);
        return listing.getShareCount();
    }

    @Transactional
    public void report(Long listingId, Long userId, MarketplaceReportRequest request) {
        String targetType = request.targetType().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("LISTING", "SELLER").contains(targetType)) throw ApiException.badRequest("Đối tượng báo cáo không hợp lệ");
        MarketplaceListing listing = readableListing(listingId, userId);
        if (listing.getSeller().getUserId().equals(userId)) throw ApiException.badRequest("Bạn không thể báo cáo tin của mình");
        if (reportRepository.existsByReporterUserIdAndListingListingIdAndTargetType(userId, listingId, targetType)) {
            throw ApiException.conflict("Bạn đã gửi báo cáo này");
        }
        reportRepository.save(MarketplaceReport.builder()
                .reporter(requireUser(userId))
                .listing(listing)
                .reportedSeller(listing.getSeller())
                .targetType(targetType)
                .reason(request.reason().trim())
                .build());
    }

    @Transactional
    public List<String> uploadImages(Long userId, List<MultipartFile> files) {
        requireUser(userId);
        if (files == null || files.isEmpty() || files.size() > MAX_IMAGES) {
            throw ApiException.badRequest("Vui lòng chọn từ 1 đến 8 ảnh sản phẩm");
        }
        return files.stream().map(file -> {
            String filename = file.getOriginalFilename();
            int extensionStart = filename == null ? -1 : filename.lastIndexOf('.');
            String extension = extensionStart < 0 ? "" : filename.substring(extensionStart + 1).toLowerCase(Locale.ROOT);
            String contentType = file.getContentType();
            if (!IMAGE_EXTENSIONS.contains(extension) || contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
                throw ApiException.badRequest("Chỉ hỗ trợ ảnh JPG, PNG, WebP hoặc GIF");
            }
            return fileStorageService.store(file);
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<String> recentSearches(Long userId) {
        return searchHistoryRepository.findByUserUserIdOrderBySearchedAtDesc(userId, PageRequest.of(0, 8))
                .stream().map(MarketplaceSearchHistory::getKeyword).distinct().toList();
    }

    @Transactional(readOnly = true)
    public String sellerLocation(Long userId) {
        return requireUser(userId).getLocation();
    }

    private void updateImages(MarketplaceListing listing, List<String> urls) {
        List<String> safeUrls = urls == null ? List.of() : urls.stream().filter(url -> url != null && !url.isBlank()).toList();
        if (safeUrls.size() > MAX_IMAGES) throw ApiException.badRequest("Mỗi tin đăng được tối đa 8 ảnh");
        for (int i = 0; i < safeUrls.size(); i++) {
            String imageUrl = safeUrls.get(i).trim();
            if (!imageUrl.startsWith("/uploads/") || imageUrl.length() > 1000) {
                throw ApiException.badRequest("Đường dẫn ảnh sản phẩm không hợp lệ");
            }
            String lower = imageUrl.toLowerCase(Locale.ROOT);
            if (IMAGE_EXTENSIONS.stream().noneMatch(extension -> lower.split("\\?", 2)[0].endsWith("." + extension))) {
                throw ApiException.badRequest("Định dạng ảnh sản phẩm không được hỗ trợ");
            }
            listing.getImages().add(MarketplaceListingImage.builder()
                    .listing(listing).imageUrl(imageUrl).imageOrder(i).build());
        }
    }

    private void validate(MarketplaceUpsertRequest request) {
        if (!CATEGORIES.contains(request.category().trim())) throw ApiException.badRequest("Danh mục sản phẩm không hợp lệ");
        if (!CONDITIONS.contains(request.condition().trim().toUpperCase(Locale.ROOT))) throw ApiException.badRequest("Tình trạng sản phẩm không hợp lệ");
        if (request.price().signum() <= 0) throw ApiException.badRequest("Giá sản phẩm phải lớn hơn 0");
    }

    private String normalizeScope(String scope) {
        String value = scope == null ? "" : scope.trim().toUpperCase(Locale.ROOT);
        return Set.of("MINE", "SAVED").contains(value) ? value : "ALL";
    }

    private String normalizeConditionFilter(String condition) {
        if (condition == null || condition.isBlank()) return "";
        String value = condition.trim().toUpperCase(Locale.ROOT);
        if (!CONDITIONS.contains(value)) throw ApiException.badRequest("Tình trạng sản phẩm không hợp lệ");
        return value;
    }

    private String normalize(String value, int maxLength) {
        if (value == null) return "";
        String normalized = value.trim();
        return normalized.length() > maxLength ? normalized.substring(0, maxLength) : normalized;
    }

    private User requireUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("Không tìm thấy người dùng"));
    }

    private MarketplaceListing requireOwner(Long listingId, Long sellerId) {
        MarketplaceListing listing = listingRepository.findById(listingId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy sản phẩm"));
        if (!listing.getSeller().getUserId().equals(sellerId)) throw ApiException.forbidden("Chỉ người bán mới được quản lý tin đăng");
        return listing;
    }

    private MarketplaceListing readableListing(Long listingId, Long userId) {
        return listingRepository.findReadableById(listingId, userId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy sản phẩm"));
    }

    private MarketplaceListingResponse toResponse(MarketplaceListing listing, Long viewerId) {
        User seller = listing.getSeller();
        String sellerName = seller.getDisplayName() == null || seller.getDisplayName().isBlank()
                ? seller.getUsername() : seller.getDisplayName();
        return new MarketplaceListingResponse(
                listing.getListingId(), seller.getUserId(), sellerName, seller.getUsername(), seller.getAvatar(),
                listing.getTitle(), listing.getDescription(), listing.getPrice(), listing.getCategory(),
                listing.getCondition(), listing.getLocation(), listing.getStatus(), listing.getViewCount(),
                listing.getShareCount(), savedItemRepository.existsByUserUserIdAndContentTypeAndContentId(viewerId, "MARKETPLACE", listing.getListingId()),
                followRepository.existsBySellerUserIdAndFollowerUserId(seller.getUserId(), viewerId),
                listing.getImages().stream().map(MarketplaceListingImage::getImageUrl).toList(),
                listing.getCreatedAt(), listing.getUpdatedAt());
    }
}
