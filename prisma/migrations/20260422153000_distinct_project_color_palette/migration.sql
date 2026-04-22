-- Revised distinct UI palette hex values live in application code (`lib/constants.ts`).
-- Assign a unique `color_key` per seed project so each appears differently in Gantt, shift board, etc.

UPDATE "projects" SET "color_key" = (
  CASE "project_code"
    WHEN 'ELBIT' THEN 'navy'
    WHEN 'PJ-10' THEN 'teal'
    WHEN 'KONKURS' THEN 'amber'
    WHEN 'VEDA' THEN 'coral'
    WHEN 'ANSP' THEN 'violet'
    WHEN 'QRSAM' THEN 'slate'
    WHEN 'NASM' THEN 'forest'
    WHEN 'MAHINDRA' THEN 'rose'
    WHEN 'MIRV' THEN 'ochre'
    WHEN 'BAH' THEN 'indigo'
    WHEN 'MICA' THEN 'pine'
    ELSE "color_key"
  END
)
WHERE "project_code" IN (
  'ELBIT',
  'PJ-10',
  'KONKURS',
  'VEDA',
  'ANSP',
  'QRSAM',
  'NASM',
  'MAHINDRA',
  'MIRV',
  'BAH',
  'MICA'
);
