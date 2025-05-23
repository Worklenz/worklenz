export const formatHoursToReadable = (hours: number) => {
  return hours / 60;
};

export const convertToHoursMinutes = (hours: number) => {
  return `${Math.floor(hours / 60)} h ${hours % 60} min`;
};
