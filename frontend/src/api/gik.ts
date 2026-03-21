import client from './client';
import type { GikData } from '../types';

export const getGikData = async (projectId: string): Promise<GikData> => {
  const { data } = await client.get(`/projects/${projectId}/gik`);
  return data.data as GikData;
};

export const updateGikData = async (
  projectId: string,
  body: Partial<Pick<GikData, 'grz' | 'bgf' | 'manualGrundstueckCost'>>,
): Promise<GikData> => {
  const { data } = await client.put(`/projects/${projectId}/gik`, body);
  return data.data as GikData;
};
