import client from './client';
import type { User } from '../types';

export const login = async (email: string, password: string) => {
  const { data } = await client.post('/auth/login', { email, password });
  return data as { token: string; user: User };
};
export const getMe = async () => {
  const { data } = await client.get('/auth/me');
  return data.data as User;
};
export const changePassword = async (currentPassword: string, newPassword: string) => {
  const { data } = await client.put('/auth/password', { currentPassword, newPassword });
  return data;
};
export const registerUser = async (body: { name: string; email: string; password: string; role: string }) => {
  const { data } = await client.post('/auth/register', body);
  return data.data as User;
};
export const getUsers = async () => {
  const { data } = await client.get('/users');
  return data.data as User[];
};
export const deleteUser = async (id: string) => {
  const { data } = await client.delete(`/users/${id}`);
  return data;
};
export const resetUserPassword = async (id: string, newPassword: string) => {
  const { data } = await client.put(`/users/${id}/password`, { newPassword });
  return data;
};
export const forgotPassword = async (email: string) => {
  const { data } = await client.post('/auth/forgot-password', { email });
  return data as { success: boolean; resetToken?: string; message?: string };
};
export const resetPassword = async (token: string, password: string) => {
  const { data } = await client.post('/auth/reset-password', { token, password });
  return data;
};
