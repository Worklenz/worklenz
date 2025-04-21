// function to fetch data
export const fetchData = async (
  url: string,
  setState: React.Dispatch<React.SetStateAction<any[]>>
) => {
  try {
    const response = await fetch(url);
    const data = await response.json();
    setState(data);
  } catch (error) {
    console.error(`Error fetching data from ${url}:`, error);
  }
};
