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
