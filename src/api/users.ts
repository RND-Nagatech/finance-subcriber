import axiosInstance from './axiosInstance';

export interface User {
  _id: string;
  username: string;
  name?: string;
  role: string;
  createdAt: string;
}

export async function fetchUsers(): Promise<User[]> {
  const res = await axiosInstance.get('/users');
  return res.data?.data ?? [];
}

export async function updateUser(id: string, data: { username?: string; name?: string; password?: string; role?: string }): Promise<User> {
  const res = await axiosInstance.put(`/users/${id}`, data);
  return res.data?.data;
}

export async function deleteUser(id: string): Promise<void> {
  await axiosInstance.delete(`/users/${id}`);
}