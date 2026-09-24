-- Restore umlauts in German category names that were seeded as ASCII
-- transliterations. Idempotent: only rows still holding the old names change.
UPDATE "Category" SET "nameDe" = 'Schlüsseldienst' WHERE "nameDe" = 'Schluesseldienst';
UPDATE "Category" SET "nameDe" = 'Büroreinigung' WHERE "nameDe" = 'Bueroreinigung';
UPDATE "Category" SET "nameDe" = 'Möbelmontage' WHERE "nameDe" = 'Moebelmontage';
