export const getDayName = (date: Date) => {
  return date.toLocaleDateString('en-US', { weekday: 'long' }); // Returns `Monday`, `Tuesday`, etc.
};
