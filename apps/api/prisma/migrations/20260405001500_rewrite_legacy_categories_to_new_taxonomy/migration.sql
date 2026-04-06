-- Reassign legacy broad categories to the new branch taxonomy and remove the
-- legacy rows so the application only serves the new category system.

WITH legacy_mapping (legacy_slug, branch_slug, sector_slug) AS (
  VALUES
    ('cleaning', 'home-cleaning', 'cleaning-care'),
    ('garden', 'garden-maintenance', 'cleaning-care'),
    ('tutoring', 'math', 'education-hobby'),
    ('photography', 'event-photo', 'art-events'),
    ('computerHelp', 'computer', 'digital-tech'),
    ('petCare', 'pet-sitter', 'pet-care')
),
resolved_mapping AS (
  SELECT
    legacy_category.id AS legacy_id,
    branch_category.id AS branch_id,
    legacy_mapping.branch_slug,
    legacy_mapping.sector_slug
  FROM legacy_mapping
  JOIN "Category" AS legacy_category
    ON legacy_category.slug = legacy_mapping.legacy_slug
  JOIN "Category" AS branch_category
    ON branch_category.slug = legacy_mapping.branch_slug
)
UPDATE "Service" AS service
SET
  "categoryId" = resolved_mapping.branch_id,
  "updatedAt" = CURRENT_TIMESTAMP
FROM resolved_mapping
WHERE service."categoryId" = resolved_mapping.legacy_id;

WITH legacy_mapping (legacy_slug, branch_slug, sector_slug) AS (
  VALUES
    ('cleaning', 'home-cleaning', 'cleaning-care'),
    ('garden', 'garden-maintenance', 'cleaning-care'),
    ('tutoring', 'math', 'education-hobby'),
    ('photography', 'event-photo', 'art-events'),
    ('computerHelp', 'computer', 'digital-tech'),
    ('petCare', 'pet-sitter', 'pet-care')
),
resolved_mapping AS (
  SELECT
    legacy_category.id AS legacy_id,
    branch_category.id AS branch_id,
    legacy_mapping.branch_slug,
    legacy_mapping.sector_slug
  FROM legacy_mapping
  JOIN "Category" AS legacy_category
    ON legacy_category.slug = legacy_mapping.legacy_slug
  JOIN "Category" AS branch_category
    ON branch_category.slug = legacy_mapping.branch_slug
)
UPDATE "ServiceRequest" AS request
SET
  "categoryId" = resolved_mapping.branch_id,
  "requestBranch" = resolved_mapping.branch_slug,
  "requestSector" = resolved_mapping.sector_slug,
  "updatedAt" = CURRENT_TIMESTAMP
FROM resolved_mapping
WHERE request."categoryId" = resolved_mapping.legacy_id;

WITH legacy_slugs (slug) AS (
  VALUES
    ('cleaning'),
    ('garden'),
    ('tutoring'),
    ('photography'),
    ('computerHelp'),
    ('petCare')
)
DELETE FROM "Category" AS category
USING legacy_slugs
WHERE category.slug = legacy_slugs.slug;
