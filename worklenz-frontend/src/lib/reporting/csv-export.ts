/** Quote CSV text and force formula-leading labels to remain literal in spreadsheets. */
export const formatCsvText = (value: string): string => {
  const safe = /^[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
};
