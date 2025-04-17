// these functions are utility functions which are use for save data and get data from local storage
export const getJSONFromLocalStorage = (name: string) => {
  const storedItem = localStorage.getItem(name);
  return storedItem ? JSON.parse(storedItem) : null;
};

export const saveJSONToLocalStorage = (name: string, item: unknown) => {
  localStorage.setItem(name, JSON.stringify(item));
};

export const saveToLocalStorage = (name: string, item: string) => {
  localStorage.setItem(name, item);
};

export const getFromLocalStorage = (name: string) => {
  return localStorage.getItem(name);
};
