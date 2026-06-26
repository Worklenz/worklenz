INSERT INTO task_priorities (name, value, color_code, color_code_dark)
SELECT 'Critical', 3, '#8B1A1A', '#B22222'
WHERE NOT EXISTS (
  SELECT 1
  FROM task_priorities
  WHERE LOWER(name) = 'critical' OR value = 3
);
