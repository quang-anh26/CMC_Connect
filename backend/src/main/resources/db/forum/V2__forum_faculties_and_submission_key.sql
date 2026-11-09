-- Additive, data-preserving update for databases that already have Forum tables.
CREATE TABLE IF NOT EXISTS forum_faculties (
 id BIGSERIAL PRIMARY KEY,
 name VARCHAR(180) NOT NULL UNIQUE,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS forum_majors (
 id BIGSERIAL PRIMARY KEY,
 faculty_id BIGINT NOT NULL REFERENCES forum_faculties(id),
 name VARCHAR(180) NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMP,
 CONSTRAINT uq_forum_major_faculty_name UNIQUE(faculty_id, name)
);

ALTER TABLE forum_topics ADD COLUMN IF NOT EXISTS faculty_id BIGINT REFERENCES forum_faculties(id);
ALTER TABLE forum_topics ADD COLUMN IF NOT EXISTS major_id BIGINT REFERENCES forum_majors(id);
ALTER TABLE forum_topics ADD COLUMN IF NOT EXISTS submission_key VARCHAR(36);
ALTER TABLE forum_topics ADD COLUMN IF NOT EXISTS resource_kind VARCHAR(32);
CREATE UNIQUE INDEX IF NOT EXISTS uq_forum_topics_submission_key
 ON forum_topics(submission_key) WHERE submission_key IS NOT NULL;
