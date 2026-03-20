import client from './client';
import type { Project, Floor, Unit, Room, Position, Container, Geruest, Kran, ProjectSummary, PositionTemplate } from '../types';

// === Projekte ===
export const getProjects = async (params?: object) => {
  const { data } = await client.get('/projects', { params });
  return data.data as Project[];
};
export const getProject = async (id: string) => {
  const { data } = await client.get(`/projects/${id}`);
  return data.data as Project;
};
export const createProject = async (body: Partial<Project>) => {
  const { data } = await client.post('/projects', body);
  return data.data as Project;
};
export const updateProject = async (id: string, body: Partial<Project>) => {
  const { data } = await client.put(`/projects/${id}`, body);
  return data.data as Project;
};
export const deleteProject = async (id: string) => client.delete(`/projects/${id}`);
export const frierePlanwerteEin  = async (id: string) => client.post(`/projects/${id}/planwerte-einfrieren`);
export const loeschePlanwerte    = async (id: string) => client.delete(`/projects/${id}/planwerte-einfrieren`);
export const getProjectSummary = async (id: string) => {
  const { data } = await client.get(`/projects/${id}/summary`);
  return data.data as ProjectSummary;
};
export const getProjectTimeline = async (id: string) => {
  const { data } = await client.get(`/projects/${id}/timeline`);
  return data.data;
};
export const getProjectAudit = async (id: string) => {
  const { data } = await client.get(`/projects/${id}/audit`);
  return data.data;
};
export const addTeamMember = async (projectId: string, body: { userId: string; role: string }) => {
  const { data } = await client.post(`/projects/${projectId}/team`, body);
  return data.data as Project;
};
export const removeTeamMember = async (projectId: string, userId: string) => {
  const { data } = await client.delete(`/projects/${projectId}/team/${userId}`);
  return data.data as Project;
};
export const updatePhaseStatus = async (projectId: string, phaseId: string, status: string) => {
  const { data } = await client.patch(`/projects/${projectId}/phases/${phaseId}`, { status });
  return data.data as Project;
};
export const updateVertriebPreise = async (projectId: string, preise: Record<string, { preisQm: string; festpreis: string }>) => {
  const { data } = await client.put(`/projects/${projectId}/vertrieb-preise`, preise);
  return data.data as Record<string, { preisQm: string; festpreis: string }>;
};

// === Etagen ===
export const getFloors = async (projectId: string) => {
  const { data } = await client.get(`/projects/${projectId}/floors`);
  return data.data as Floor[];
};
export const createFloor = async (projectId: string, body: Partial<Floor>) => {
  const { data } = await client.post(`/projects/${projectId}/floors`, body);
  return data.data as Floor;
};
export const updateFloor = async (projectId: string, id: string, body: Partial<Floor>) => {
  const { data } = await client.put(`/projects/${projectId}/floors/${id}`, body);
  return data.data as Floor;
};
export const deleteFloor = async (projectId: string, id: string) =>
  client.delete(`/projects/${projectId}/floors/${id}`);

// === Wohnungen ===
export const getUnits = async (projectId: string, params?: object) => {
  const { data } = await client.get(`/projects/${projectId}/units`, { params });
  return data.data as Unit[];
};
export const createUnit = async (projectId: string, body: Partial<Unit>) => {
  const { data } = await client.post(`/projects/${projectId}/units`, body);
  return data.data as Unit;
};
export const updateUnit = async (projectId: string, id: string, body: { name?: string; number?: string }) => {
  const { data } = await client.put(`/projects/${projectId}/units/${id}`, body);
  return data.data;
};
export const deleteUnit = async (projectId: string, id: string) =>
  client.delete(`/projects/${projectId}/units/${id}`);

export const copyUnit = async (
  projectId: string,
  id: string,
  body: { targetFloorId?: string; newName?: string; newNumber?: string; copyRooms?: boolean }
) => {
  const { data } = await client.post(`/projects/${projectId}/units/${id}/copy`, body);
  return data.data as { unit: Unit; rooms: Room[] };
};

// === Räume ===
export const getRooms = async (projectId: string, params?: object) => {
  const { data } = await client.get(`/projects/${projectId}/rooms`, { params });
  return data.data as Room[];
};
export const getRoom = async (projectId: string, id: string) => {
  const { data } = await client.get(`/projects/${projectId}/rooms/${id}`);
  return data.data as Room;
};
export const createRoom = async (projectId: string, body: Partial<Room>) => {
  const { data } = await client.post(`/projects/${projectId}/rooms`, body);
  return data.data as Room;
};
export const updateRoom = async (projectId: string, id: string, body: Partial<Room>) => {
  const { data } = await client.put(`/projects/${projectId}/rooms/${id}`, body);
  return data.data as Room;
};
export const deleteRoom = async (projectId: string, id: string) =>
  client.delete(`/projects/${projectId}/rooms/${id}`);

export const copyRoom = async (
  projectId: string,
  id: string,
  body: { targetUnitId?: string | null; targetFloorId?: string }
) => {
  const { data } = await client.post(`/projects/${projectId}/rooms/${id}/copy`, body);
  return data.data as Room;
};

// === Positionen ===
export const getPositions = async (projectId: string, params?: object) => {
  const { data } = await client.get(`/projects/${projectId}/positions`, { params });
  return data.data as Position[];
};
export const createPosition = async (projectId: string, body: Partial<Position>) => {
  const { data } = await client.post(`/projects/${projectId}/positions`, body);
  return data.data as Position;
};
export const updatePosition = async (projectId: string, id: string, body: Partial<Position>) => {
  const { data } = await client.put(`/projects/${projectId}/positions/${id}`, body);
  return data.data as Position;
};
export const deletePosition = async (projectId: string, id: string) =>
  client.delete(`/projects/${projectId}/positions/${id}`);
export const bulkCreatePositions = async (projectId: string, positions: object[]) => {
  const { data } = await client.post(`/projects/${projectId}/positions/bulk`, { positions });
  return data as { count: number; data: Position[] };
};

// === Container ===
export const getContainers = async (projectId: string) => {
  const { data } = await client.get(`/projects/${projectId}/containers`);
  return data.data as Container[];
};
export const getContainerSuggestion = async (projectId: string) => {
  const { data } = await client.get(`/projects/${projectId}/containers/suggestion`);
  return data.data;
};
export const createContainer = async (projectId: string, body: Partial<Container>) => {
  const { data } = await client.post(`/projects/${projectId}/containers`, body);
  return data.data as Container;
};
export const updateContainer = async (projectId: string, id: string, body: Partial<Container>) => {
  const { data } = await client.put(`/projects/${projectId}/containers/${id}`, body);
  return data.data as Container;
};
export const deleteContainer = async (projectId: string, id: string) =>
  client.delete(`/projects/${projectId}/containers/${id}`);

// === Gerüst ===
export const getGerueste = async (projectId: string) => {
  const { data } = await client.get(`/projects/${projectId}/geruest`);
  return data.data as Geruest[];
};
export const createGeruest = async (projectId: string, body: Partial<Geruest>) => {
  const { data } = await client.post(`/projects/${projectId}/geruest`, body);
  return data.data as Geruest;
};
export const updateGeruest = async (projectId: string, id: string, body: Partial<Geruest>) => {
  const { data } = await client.put(`/projects/${projectId}/geruest/${id}`, body);
  return data.data as Geruest;
};
export const deleteGeruest = async (projectId: string, id: string) =>
  client.delete(`/projects/${projectId}/geruest/${id}`);

// === Kran ===
export const getKraene = async (projectId: string) => {
  const { data } = await client.get(`/projects/${projectId}/kran`);
  return data.data as Kran[];
};
export const createKran = async (projectId: string, body: Partial<Kran>) => {
  const { data } = await client.post(`/projects/${projectId}/kran`, body);
  return data.data as Kran;
};
export const updateKran = async (projectId: string, id: string, body: Partial<Kran>) => {
  const { data } = await client.put(`/projects/${projectId}/kran/${id}`, body);
  return data.data as Kran;
};
export const deleteKran = async (projectId: string, id: string) =>
  client.delete(`/projects/${projectId}/kran/${id}`);

// === Vorlagen ===
export const getTemplates = async (phaseType?: string) => {
  const { data } = await client.get('/templates', { params: { phaseType } });
  return data.data as PositionTemplate[];
};
export const createTemplate = async (body: Partial<PositionTemplate>) => {
  const { data } = await client.post('/templates', body);
  return data.data as PositionTemplate;
};
export const updateTemplate = async (id: string, body: Partial<PositionTemplate>) => {
  const { data } = await client.put(`/templates/${id}`, body);
  return data.data as PositionTemplate;
};
export const deleteTemplateApi = async (id: string) =>
  client.delete(`/templates/${id}`);
