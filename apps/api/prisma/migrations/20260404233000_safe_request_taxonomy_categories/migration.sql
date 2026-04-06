-- Insert the new request taxonomy categories without rewriting legacy rows.
-- Legacy broad categories remain intact so existing production data is preserved.

WITH sector_data (id, slug, "nameDe", "nameEn", icon, "isActive") AS (
  VALUES
    ('20000000-0000-4000-8000-000000000001', 'home-repair', 'Hausreparatur & Renovierung', 'Home Repair & Renovation', '🧰', FALSE),
    ('20000000-0000-4000-8000-000000000002', 'cleaning-care', 'Reinigung & Haushaltspflege', 'Cleaning & Home Care', '🪄', FALSE),
    ('20000000-0000-4000-8000-000000000003', 'education-hobby', 'Bildung, Kurse & Hobby', 'Education, Courses & Hobby', '🎓', FALSE),
    ('20000000-0000-4000-8000-000000000004', 'art-events', 'Kunst, Foto & Events', 'Art, Photo & Events', '🎭', FALSE),
    ('20000000-0000-4000-8000-000000000005', 'health-beauty', 'Gesundheit & Beauty', 'Health & Beauty', '🪞', FALSE),
    ('20000000-0000-4000-8000-000000000006', 'digital-tech', 'Digital & Technologie', 'Digital & Technology', '🧠', FALSE),
    ('20000000-0000-4000-8000-000000000007', 'logistics', 'Transport & Logistik', 'Transport & Logistics', '🚚', FALSE),
    ('20000000-0000-4000-8000-000000000008', 'pet-care', 'Haustierdienste', 'Pet Services', '🐾', FALSE)
)
INSERT INTO "Category" ("id", "slug", "nameDe", "nameEn", "icon", "parentId", "isActive", "createdAt", "updatedAt")
SELECT id, slug, "nameDe", "nameEn", icon, NULL, "isActive", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM sector_data
ON CONFLICT ("slug") DO UPDATE
SET
  "nameDe" = EXCLUDED."nameDe",
  "nameEn" = EXCLUDED."nameEn",
  "icon" = EXCLUDED."icon",
  "parentId" = NULL,
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = CURRENT_TIMESTAMP;

WITH branch_data (id, slug, "nameDe", "nameEn", icon, parent_slug) AS (
  VALUES
    ('21000000-0000-4000-8000-000000000001', 'electrician', 'Elektriker', 'Electrician', '⚡', 'home-repair'),
    ('21000000-0000-4000-8000-000000000002', 'plumber', 'Installateur', 'Plumber', '🔧', 'home-repair'),
    ('21000000-0000-4000-8000-000000000003', 'painter', 'Maler', 'Painter', '🎨', 'home-repair'),
    ('21000000-0000-4000-8000-000000000004', 'locksmith', 'Schluesseldienst', 'Locksmith', '🔐', 'home-repair'),
    ('21000000-0000-4000-8000-000000000005', 'renovation', 'Renovierung', 'Renovation', '🔨', 'home-repair'),
    ('21000000-0000-4000-8000-000000000006', 'home-cleaning', 'Hausreinigung', 'Home Cleaning', '🧹', 'cleaning-care'),
    ('21000000-0000-4000-8000-000000000007', 'office-cleaning', 'Bueroreinigung', 'Office Cleaning', '🧼', 'cleaning-care'),
    ('21000000-0000-4000-8000-000000000008', 'deep-cleaning', 'Grundreinigung', 'Deep Cleaning', '✨', 'cleaning-care'),
    ('21000000-0000-4000-8000-000000000009', 'garden-maintenance', 'Gartenpflege', 'Garden Maintenance', '🌳', 'cleaning-care'),
    ('21000000-0000-4000-8000-000000000010', 'math', 'Matheunterricht', 'Math Lessons', '📚', 'education-hobby'),
    ('21000000-0000-4000-8000-000000000011', 'english', 'Englischunterricht', 'English Lessons', '🗣️', 'education-hobby'),
    ('21000000-0000-4000-8000-000000000012', 'music', 'Musikunterricht', 'Music Lessons', '🎵', 'education-hobby'),
    ('21000000-0000-4000-8000-000000000013', 'wedding-photo', 'Hochzeitsfotograf', 'Wedding Photographer', '📸', 'art-events'),
    ('21000000-0000-4000-8000-000000000014', 'event-photo', 'Eventfotograf', 'Event Photographer', '📷', 'art-events'),
    ('21000000-0000-4000-8000-000000000015', 'video', 'Videoaufnahme', 'Video Shooting', '🎬', 'art-events'),
    ('21000000-0000-4000-8000-000000000016', 'beauty', 'Beautydienst', 'Beauty Service', '💄', 'health-beauty'),
    ('21000000-0000-4000-8000-000000000017', 'hair', 'Friseur (Hausbesuch)', 'Hairdresser (Home Visit)', '💇', 'health-beauty'),
    ('21000000-0000-4000-8000-000000000018', 'computer', 'Computerhilfe', 'Computer Help', '💻', 'digital-tech'),
    ('21000000-0000-4000-8000-000000000019', 'software', 'Software & IT Support', 'Software & IT Support', '🖥️', 'digital-tech'),
    ('21000000-0000-4000-8000-000000000020', 'website', 'Webentwicklung', 'Website Development', '🌐', 'digital-tech'),
    ('21000000-0000-4000-8000-000000000021', 'moving', 'Umzug', 'Home Moving', '📦', 'logistics'),
    ('21000000-0000-4000-8000-000000000022', 'furniture', 'Moebelmontage', 'Furniture Assembly', '🪑', 'logistics'),
    ('21000000-0000-4000-8000-000000000023', 'storage', 'Lagerung', 'Storage & Mini Warehouse', '🏷️', 'logistics'),
    ('21000000-0000-4000-8000-000000000024', 'pet-sitter', 'Tiersitting', 'Pet Sitting', '🐾', 'pet-care'),
    ('21000000-0000-4000-8000-000000000025', 'dog-walk', 'Hundeservice', 'Dog Walking', '🦮', 'pet-care'),
    ('21000000-0000-4000-8000-000000000026', 'pet-groom', 'Tierpflege', 'Pet Grooming', '✂️', 'pet-care')
),
resolved_branch_data AS (
  SELECT
    branch_data.id,
    branch_data.slug,
    branch_data."nameDe",
    branch_data."nameEn",
    branch_data.icon,
    parent_category.id AS parent_id
  FROM branch_data
  JOIN "Category" AS parent_category
    ON parent_category.slug = branch_data.parent_slug
)
INSERT INTO "Category" ("id", "slug", "nameDe", "nameEn", "icon", "parentId", "isActive", "createdAt", "updatedAt")
SELECT id, slug, "nameDe", "nameEn", icon, parent_id, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM resolved_branch_data
ON CONFLICT ("slug") DO UPDATE
SET
  "nameDe" = EXCLUDED."nameDe",
  "nameEn" = EXCLUDED."nameEn",
  "icon" = EXCLUDED."icon",
  "parentId" = EXCLUDED."parentId",
  "isActive" = TRUE,
  "updatedAt" = CURRENT_TIMESTAMP;

WITH branch_taxonomy (branch_slug, sector_slug) AS (
  VALUES
    ('electrician', 'home-repair'),
    ('plumber', 'home-repair'),
    ('painter', 'home-repair'),
    ('locksmith', 'home-repair'),
    ('renovation', 'home-repair'),
    ('home-cleaning', 'cleaning-care'),
    ('office-cleaning', 'cleaning-care'),
    ('deep-cleaning', 'cleaning-care'),
    ('garden-maintenance', 'cleaning-care'),
    ('math', 'education-hobby'),
    ('english', 'education-hobby'),
    ('music', 'education-hobby'),
    ('wedding-photo', 'art-events'),
    ('event-photo', 'art-events'),
    ('video', 'art-events'),
    ('beauty', 'health-beauty'),
    ('hair', 'health-beauty'),
    ('computer', 'digital-tech'),
    ('software', 'digital-tech'),
    ('website', 'digital-tech'),
    ('moving', 'logistics'),
    ('furniture', 'logistics'),
    ('storage', 'logistics'),
    ('pet-sitter', 'pet-care'),
    ('dog-walk', 'pet-care'),
    ('pet-groom', 'pet-care')
)
UPDATE "ServiceRequest" AS request
SET
  "requestBranch" = taxonomy.branch_slug,
  "requestSector" = taxonomy.sector_slug,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Category" AS category
JOIN branch_taxonomy AS taxonomy
  ON taxonomy.branch_slug = category.slug
WHERE request."categoryId" = category.id
  AND (
    request."requestBranch" IS DISTINCT FROM taxonomy.branch_slug
    OR request."requestSector" IS DISTINCT FROM taxonomy.sector_slug
  );
