import axios from 'axios';
import { secureStorage } from '@/utils/secureStorage';
import { getLoginFallbackUrl } from '@/utils/programInternalRedirect';

const AUTH_401_EXCLUDED_PATHS = [
  '/auth/login',
  '/auth/login-challenge',
  '/auth/login-verify',
  '/auth/register',
];

const isAuth401ExcludedRequest = (url?: string) => {
  if (!url) return false;
  return AUTH_401_EXCLUDED_PATHS.some((path) => url.includes(path));
};

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://192.168.110.21:5001/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor untuk menambahkan token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = secureStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor untuk handle error
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url as string | undefined;
    if (status === 401 && !isAuth401ExcludedRequest(requestUrl)) {
      const fallbackUrl = getLoginFallbackUrl();
      secureStorage.removeItem('auth_token');
      secureStorage.removeItem('user_name');
      secureStorage.removeItem('user_role');
      window.location.href = fallbackUrl;
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
