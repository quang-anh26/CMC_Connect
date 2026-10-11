package com.example.messaging.service;

import com.example.messaging.dto.saved.*;
import com.example.messaging.entity.*;
import com.example.messaging.exception.ApiException;
import com.example.messaging.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class SavedService {
    private static final Set<String> TYPES = Set.of("POST", "VIDEO", "MARKETPLACE", "GROUP_POST", "LINK");
    private static final Pattern LINK_PATTERN = Pattern.compile("https?://[^\\s<>()]+", Pattern.CASE_INSENSITIVE);

    private final SavedItemRepository savedItemRepository;
    private final SavedCollectionRepository collectionRepository;
    private final CollectionItemRepository collectionItemRepository;
    private final SocialPostRepository socialPostRepository;
    private final GroupPostRepository groupPostRepository;
    private final SocialGroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final GroupBanRepository groupBanRepository;
    private final MarketplaceListingRepository marketplaceListingRepository;
    private final VideoSavedRepository legacyVideoSavedRepository;
    private final MarketplaceSavedRepository legacyMarketplaceSavedRepository;
    private final UserRepository userRepository;
    private final FeedService feedService;

    @Transactional
    public Map<String, Object> toggle(Long userId, SaveItemRequest request) {
        syncLegacyItems(userId);
        String type = normalizeType(request.contentType());
        if (request.contentId() <= 0) throw ApiException.badRequest("Nội dung cần lưu không hợp lệ");
        Optional<SavedItem> existing = savedItemRepository.findByUserUserIdAndContentTypeAndContentId(
                userId, type, request.contentId());
        if (existing.isPresent()) {
            savedItemRepository.delete(existing.get());
            return Map.of("saved", false);
        }
        validateReadable(type, request.contentId(), userId);
        SavedItem item = savedItemRepository.save(SavedItem.builder()
                .user(userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("Không tìm thấy người dùng")))
                .contentType(type)
                .contentId(request.contentId())
                .build());
        if (request.collectionId() != null) addToCollection(item, request.collectionId(), userId);
        return Map.of("saved", true, "savedItemId", item.getSavedItemId());
    }

    @Transactional
    public void unsave(Long savedItemId, Long userId) {
        SavedItem item = ownedItem(savedItemId, userId);
        savedItemRepository.delete(item);
    }

    @Transactional
    public Page<SavedItemResponse> list(Long userId, String type, String keyword, Long collectionId,
                                        String sort, int page, int size) {
        syncLegacyItems(userId);
        String normalizedType = type == null || type.isBlank() || "ALL".equalsIgnoreCase(type)
                ? "" : normalizeType(type);
        if (collectionId != null) ownedCollection(collectionId, userId);
        Sort.Direction direction = "OLDEST".equalsIgnoreCase(sort) ? Sort.Direction.ASC : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 50)),
                Sort.by(direction, "savedAt").and(Sort.by(direction, "savedItemId")));
        return savedItemRepository.search(userId, normalizedType, collectionId,
                        keyword == null ? "" : keyword.trim(), pageable)
                .map(item -> toResponse(item, userId));
    }

    @Transactional(readOnly = true)
    public List<SavedCollectionResponse> collections(Long userId) {
        return collectionRepository.findByUserUserIdOrderByCreatedAtAsc(userId).stream()
                .map(collection -> new SavedCollectionResponse(collection.getCollectionId(), collection.getName(),
                        collection.getCreatedAt(), collectionItemRepository.countByCollectionCollectionId(collection.getCollectionId())))
                .toList();
    }

    @Transactional
    public SavedCollectionResponse createCollection(Long userId, SavedCollectionRequest request) {
        SavedCollection collection = collectionRepository.save(SavedCollection.builder()
                .user(userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("Không tìm thấy người dùng")))
                .name(request.name().trim())
                .build());
        return collectionResponse(collection);
    }

    @Transactional
    public SavedCollectionResponse renameCollection(Long collectionId, Long userId, SavedCollectionRequest request) {
        SavedCollection collection = ownedCollection(collectionId, userId);
        collection.setName(request.name().trim());
        return collectionResponse(collection);
    }

    @Transactional
    public void deleteCollection(Long collectionId, Long userId) {
        SavedCollection collection = ownedCollection(collectionId, userId);
        collectionItemRepository.unlinkCollection(collectionId);
        collectionRepository.delete(collection);
    }

    @Transactional
    public void addToCollection(Long savedItemId, Long collectionId, Long userId) {
        SavedItem item = ownedItem(savedItemId, userId);
        addToCollection(item, collectionId, userId);
    }

    @Transactional
    public void removeFromCollection(Long savedItemId, Long userId) {
        ownedItem(savedItemId, userId);
        collectionItemRepository.unlinkSavedItem(savedItemId);
    }

    @Transactional
    public boolean isSaved(Long userId, String contentType, Long contentId) {
        syncLegacyItems(userId);
        return savedItemRepository.existsByUserUserIdAndContentTypeAndContentId(userId, normalizeType(contentType), contentId);
    }

    private void syncLegacyItems(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("Không tìm thấy người dùng"));
        for (VideoSaved legacy : legacyVideoSavedRepository.findByUserUserIdOrderByCreatedAtDesc(userId)) {
            Long postId = legacy.getPost().getPostId();
            if (!savedItemRepository.existsByUserUserIdAndContentTypeAndContentId(userId, "VIDEO", postId)) {
                savedItemRepository.save(SavedItem.builder().user(user).contentType("VIDEO")
                        .contentId(postId).savedAt(legacy.getCreatedAt()).build());
            }
            legacyVideoSavedRepository.delete(legacy);
        }
        for (MarketplaceSaved legacy : legacyMarketplaceSavedRepository.findByUserUserIdOrderBySavedAtDesc(userId)) {
            Long listingId = legacy.getListing().getListingId();
            if (!savedItemRepository.existsByUserUserIdAndContentTypeAndContentId(userId, "MARKETPLACE", listingId)) {
                savedItemRepository.save(SavedItem.builder().user(user).contentType("MARKETPLACE")
                        .contentId(listingId).savedAt(legacy.getSavedAt()).build());
            }
            legacyMarketplaceSavedRepository.delete(legacy);
        }
    }

    private void addToCollection(SavedItem item, Long collectionId, Long userId) {
        SavedCollection collection = ownedCollection(collectionId, userId);
        collectionItemRepository.unlinkSavedItem(item.getSavedItemId());
        collectionItemRepository.save(CollectionItem.builder().savedItem(item).collection(collection).build());
    }

    private SavedItem ownedItem(Long savedItemId, Long userId) {
        SavedItem item = savedItemRepository.findById(savedItemId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy nội dung đã lưu"));
        if (!item.getUser().getUserId().equals(userId)) throw ApiException.forbidden("Bạn không có quyền thay đổi nội dung đã lưu này");
        return item;
    }

    private SavedCollection ownedCollection(Long collectionId, Long userId) {
        return collectionRepository.findByCollectionIdAndUserUserId(collectionId, userId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy bộ sưu tập"));
    }

    private String normalizeType(String type) {
        String normalized = type == null ? "" : type.trim().toUpperCase(Locale.ROOT);
        if ("PRODUCT".equals(normalized)) normalized = "MARKETPLACE";
        if (!TYPES.contains(normalized)) throw ApiException.badRequest("Loại nội dung đã lưu không hợp lệ");
        return normalized;
    }

    private void validateReadable(String type, Long contentId, Long userId) {
        switch (type) {
            case "POST", "VIDEO", "LINK" -> {
                SocialPost post = socialPostRepository.findById(contentId)
                        .orElseThrow(() -> ApiException.notFound("Không tìm thấy bài viết"));
                if (!feedService.canView(post, userId)) throw ApiException.notFound("Không tìm thấy bài viết");
                if ("VIDEO".equals(type) && !"VIDEO".equalsIgnoreCase(post.getMediaType()))
                    throw ApiException.badRequest("Nội dung này không phải video");
                if ("LINK".equals(type) && findLink(post.getContent()) == null)
                    throw ApiException.badRequest("Bài viết không chứa liên kết");
                if ("POST".equals(type) && "VIDEO".equalsIgnoreCase(post.getMediaType()))
                    throw ApiException.badRequest("Video cần được lưu theo loại video");
            }
            case "MARKETPLACE" -> marketplaceListingRepository.findReadableById(contentId, userId)
                    .orElseThrow(() -> ApiException.notFound("Không tìm thấy sản phẩm"));
            case "GROUP_POST" -> {
                GroupPost post = groupPostRepository.findById(contentId)
                        .orElseThrow(() -> ApiException.notFound("Không tìm thấy bài viết nhóm"));
                SocialGroup group = groupRepository.findById(post.getGroup().getGroupId())
                        .orElseThrow(() -> ApiException.notFound("Không tìm thấy nhóm"));
                if (groupBanRepository.findByGroupGroupIdAndUserUserId(group.getGroupId(), userId).isPresent()
                        || ("PRIVATE".equalsIgnoreCase(group.getVisibility())
                        && !groupMemberRepository.existsByGroupGroupIdAndUserUserId(group.getGroupId(), userId))) {
                    throw ApiException.notFound("Không tìm thấy bài viết nhóm");
                }
                if (!"PUBLISHED".equalsIgnoreCase(post.getStatus())) throw ApiException.notFound("Không tìm thấy bài viết nhóm");
            }
            default -> throw ApiException.badRequest("Loại nội dung đã lưu không hợp lệ");
        }
    }

    private SavedItemResponse toResponse(SavedItem item, Long userId) {
        String title = "";
        String description = "";
        String authorName = "";
        String avatar = null;
        String previewUrl = null;
        String targetUrl = null;
        String sourcePath = "";
        switch (item.getContentType()) {
                case "POST", "VIDEO", "LINK" -> {
                    SocialPost post = socialPostRepository.findById(item.getContentId()).orElse(null);
                    if (post != null && feedService.canView(post, userId)) {
                        title = post.getContent();
                        authorName = displayName(post.getAuthor());
                        avatar = post.getAuthor().getAvatar();
                        previewUrl = post.getImageUrl();
                        sourcePath = "/feed";
                        if ("LINK".equals(item.getContentType())) targetUrl = findLink(post.getContent());
                        else sourcePath = "VIDEO".equals(item.getContentType()) ? "/video" : "/feed";
                    } else description = "Nội dung không còn khả dụng.";
                }
                case "GROUP_POST" -> {
                    GroupPost post = groupPostRepository.findById(item.getContentId()).orElse(null);
                    boolean canRead = post != null
                            && groupBanRepository.findByGroupGroupIdAndUserUserId(post.getGroup().getGroupId(), userId).isEmpty()
                            && (!"PRIVATE".equalsIgnoreCase(post.getGroup().getVisibility())
                            || groupMemberRepository.existsByGroupGroupIdAndUserUserId(post.getGroup().getGroupId(), userId));
                    if (canRead) {
                        title = post.getContent();
                        authorName = displayName(post.getAuthor());
                        avatar = post.getAuthor().getAvatar();
                        previewUrl = post.getMediaUrl();
                        sourcePath = "/groups/" + post.getGroup().getGroupId();
                    } else description = "Bài viết nhóm không còn tồn tại.";
                }
                case "MARKETPLACE" -> {
                    MarketplaceListing listing = marketplaceListingRepository.findReadableById(item.getContentId(), userId).orElse(null);
                    if (listing != null) {
                        title = listing.getTitle();
                        description = listing.getDescription();
                        authorName = displayName(listing.getSeller());
                        avatar = listing.getSeller().getAvatar();
                        previewUrl = listing.getImages().isEmpty() ? null : listing.getImages().get(0).getImageUrl();
                        sourcePath = "/marketplace/" + listing.getListingId();
                    } else description = "Sản phẩm không còn khả dụng.";
                }
                default -> description = "Nội dung không còn khả dụng.";
        }
        CollectionItem relation = item.getCollectionItem();
        SavedCollection collection = relation == null ? null : relation.getCollection();
        return new SavedItemResponse(item.getSavedItemId(), item.getContentType(), item.getContentId(),
                title, description, authorName, avatar, previewUrl, targetUrl, sourcePath, item.getSavedAt(),
                collection == null ? null : collection.getCollectionId(), collection == null ? null : collection.getName());
    }

    private String displayName(User user) {
        return user.getDisplayName() == null || user.getDisplayName().isBlank() ? user.getUsername() : user.getDisplayName();
    }

    private String findLink(String text) {
        if (text == null) return null;
        Matcher matcher = LINK_PATTERN.matcher(text);
        return matcher.find() ? matcher.group() : null;
    }

    private SavedCollectionResponse collectionResponse(SavedCollection collection) {
        return new SavedCollectionResponse(collection.getCollectionId(), collection.getName(), collection.getCreatedAt(),
                collectionItemRepository.countByCollectionCollectionId(collection.getCollectionId()));
    }
}
