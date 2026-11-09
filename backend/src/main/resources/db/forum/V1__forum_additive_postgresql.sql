-- Safe additive Forum schema for PostgreSQL. Never drops or alters existing Social tables.
-- The application currently uses spring.jpa.hibernate.ddl-auto=update; this script is
-- provided for controlled/manual provisioning and is intentionally CREATE-only.
CREATE TABLE IF NOT EXISTS forum_categories (
 id BIGSERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE,
 description VARCHAR(500), active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS forum_courses (
 id BIGSERIAL PRIMARY KEY, code VARCHAR(30) NOT NULL, name VARCHAR(150) NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS forum_faculties (
 id BIGSERIAL PRIMARY KEY, name VARCHAR(180) NOT NULL UNIQUE,
 active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS forum_majors (
 id BIGSERIAL PRIMARY KEY, faculty_id BIGINT NOT NULL REFERENCES forum_faculties(id),
 name VARCHAR(180) NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP,
 CONSTRAINT uq_forum_major_faculty_name UNIQUE(faculty_id,name)
);
CREATE TABLE IF NOT EXISTS forum_topics (
 id BIGSERIAL PRIMARY KEY, author_id BIGINT NOT NULL REFERENCES users(user_id),
 category_id BIGINT REFERENCES forum_categories(id), course_id BIGINT REFERENCES forum_courses(id),
 type VARCHAR(20) NOT NULL, title VARCHAR(180) NOT NULL, content TEXT NOT NULL,
 source VARCHAR(500), status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED', view_count BIGINT NOT NULL DEFAULT 0,
 faculty_id BIGINT REFERENCES forum_faculties(id), major_id BIGINT REFERENCES forum_majors(id),
 submission_key VARCHAR(36) UNIQUE, resource_kind VARCHAR(32), created_at TIMESTAMP, updated_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_forum_topics_created ON forum_topics(created_at);
CREATE INDEX IF NOT EXISTS idx_forum_topics_status ON forum_topics(status);
CREATE TABLE IF NOT EXISTS forum_replies (
 id BIGSERIAL PRIMARY KEY, topic_id BIGINT NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
 author_id BIGINT NOT NULL REFERENCES users(user_id), content TEXT NOT NULL, created_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS forum_attachments (
 id BIGSERIAL PRIMARY KEY, topic_id BIGINT NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
 original_name VARCHAR(255) NOT NULL, stored_name VARCHAR(255) NOT NULL UNIQUE,
 content_type VARCHAR(120) NOT NULL, size_bytes BIGINT NOT NULL, created_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS forum_bookmarks (
 id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(user_id),
 topic_id BIGINT NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE, created_at TIMESTAMP,
 CONSTRAINT uq_forum_bookmark UNIQUE(user_id,topic_id)
);
CREATE TABLE IF NOT EXISTS forum_reports (
 id BIGSERIAL PRIMARY KEY, topic_id BIGINT NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
 reporter_id BIGINT NOT NULL REFERENCES users(user_id), reason VARCHAR(500) NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'OPEN', created_at TIMESTAMP
);
