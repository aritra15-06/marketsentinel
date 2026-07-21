// Utility to dynamically get API base URL for mobile connection
export const getApiBase = () => {
  return localStorage.getItem('api_base_url') || 'http://127.0.0.1:8000';
};

// Utility to set API base URL
export const setApiBase = (url) => {
  let formattedUrl = url.trim();
  if (formattedUrl.endsWith('/')) {
    formattedUrl = formattedUrl.slice(0, -1);
  }
  localStorage.setItem('api_base_url', formattedUrl);
};
