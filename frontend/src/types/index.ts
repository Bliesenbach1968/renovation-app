export type UserRole = 'admin' | 'projectLeader' | 'calculator' | 'worker' | 'external';
export type PhaseType = 'demolition' | 'renovation' | 'specialConstruction';
export type PhaseStatus = 'planned' | 'active' | 'completed';
export type ProjectStatus = 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled';
export type PositionUnit = 'm²' | 'm³' | 'lfm' | 'Stück' | 'Sack' | 'kg' | 'Psch' | 't';
export type PositionStatus = 'planned' | 'in-progress' | 'completed';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

export interface Address { street: string; zipCode: string; city: string; country: string; }
export interface Client { name?: string; company?: string; phone?: string; email?: string; }
export interface Timeline { plannedStart?: string; plannedEnd?: string; actualStart?: string; actualEnd?: string; }

export interface Phase {
  _id: string;
  type: PhaseType;
  name: string;
  status: PhaseStatus;
  timeline: Timeline;
  order: number;
}

export interface TeamMember { userId: User; role: UserRole; }

export interface Project {
  _id: string;
  projectNumber: string;
  name: string;
  address: Address;
  client: Client;
  description?: string;
  status: ProjectStatus;
  team: TeamMember[];
  phases: Phase[];
  timeline: Timeline;
  settings: { defaultHourlyRate: number; defaultEstrichThickness: number; currency: string; };
  anzahlWohnungen?: number;
  anzahlGewerbe?: number;
  etagenOhneKeller?: number;
  kellerAnzahl?: number;
  tiefgarage?: boolean;
  tiefgarageStellplaetze?: number;
  aussenanlagenVorhanden?: boolean;
  createdBy: User;
  createdAt: string;
  updatedAt: string;
}

export interface Floor {
  _id: string;
  projectId: string;
  name: string;
  level: number;
  phaseType?: string | null;
  description?: string;
  order: number;
}

export interface Unit {
  _id: string;
  projectId: string;
  floorId: Floor | string;
  name: string;
  number?: string;
}

export interface Room {
  _id: string;
  projectId: string;
  floorId: Floor | string;
  unitId?: Unit | string | null;
  name: string;
  type: string;
  dimensions: { length?: number; width?: number; height?: number; area?: number; volume?: number; };
  properties: string[];
  notes?: string;
}

export interface Position {
  _id: string;
  projectId: string;
  roomId: Room | string;
  phaseType: PhaseType;
  templateId?: string;
  name: string;
  category: string;
  bereich?: string | null;
  aussenanlageUnterpunkt?: string | null;
  bereichUnterpunkt?: string | null;
  description?: string;
  unit: PositionUnit;
  quantity: number;
  estrichThickness?: number;
  materialCostPerUnit: number;
  disposalCostPerUnit: number;
  laborHoursPerUnit: number;
  laborHourlyRate: number;
  materialCost: number;
  disposalCost: number;
  laborCost: number;
  totalCost: number;
  plannedHours: number;
  actualHours: number;
  status: PositionStatus;
  createdBy?: User;
  updatedBy?: User;
}

export interface Container {
  _id: string;
  projectId: string;
  phaseType: string;
  type: string;
  sizeCubicMeters: number;
  quantity: number;
  pricePerContainer: number;
  totalCost: number;
  notes?: string;
  deliveryDate?: string;
  pickupDate?: string;
}

export interface Geruest {
  _id: string;
  projectId: string;
  phaseType: string;
  type: string;
  areaSqm: number;
  rentalWeeks: number;
  pricePerSqmPerWeek: number;
  assemblyDisassemblyCost: number;
  totalCost: number;
  notes?: string;
}

export interface Kran {
  _id: string;
  projectId: string;
  phaseType: string;
  type: string;
  rentalDays: number;
  pricePerDay: number;
  operatorCostPerDay: number;
  totalCost: number;
  notes?: string;
}

export interface PositionTemplate {
  _id: string;
  name: string;
  category: string;
  bereich?: string | null;
  aussenanlageUnterpunkt?: string | null;
  bereichUnterpunkt?: string | null;
  phaseType: PhaseType | 'all';
  unit: PositionUnit;
  materialCostPerUnit: number;
  disposalCostPerUnit: number;
  laborHoursPerUnit: number;
  laborHourlyRate: number;
  description?: string;
  isSystemDefault: boolean;
}

export interface PhaseSummary {
  materialCost: number;
  disposalCost: number;
  laborCost: number;
  containerCost: number;
  geruestCost: number;
  kranCost: number;
  subtotal: number;
  totalHours: number;
  positionCount: number;
}

export interface ProjectSummary {
  phases: Record<PhaseType, PhaseSummary>;
  totals: { materialCost: number; disposalCost: number; laborCost: number; containerCost: number; geruestCost: number; kranCost: number; grandTotal: number; totalHours: number; };
}
