import axios from "axios";

const api = axios.create({
  baseURL: "http://192.168.110.49:5000/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user_name");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
