export interface User {
  id: number;
  email: string;
  password_hash: string;
  created_at: string; // ISO string
}

export interface Preferences {
  [key: string]: unknown;
}

export interface TravelPlanBasic {
  id: number;
  user_id: number;
  destination: string;
  start_date: string; // ISO yyyy-mm-dd
  end_date: string;   // ISO yyyy-mm-dd
  budget?: number | null;
  party_size?: number | null;
  preferences_json?: string | null;
  created_at: string;
}

export interface Segment {
  title: string;
  startTime?: string; // e.g., HH:mm
  endTime?: string;   // e.g., HH:mm
  location?: string;
  notes?: string;
}

export interface PlanDay {
  id: number;
  plan_id: number;
  day_index: number;
  segments_json: string; // JSON.stringify(Segment[])
}

export interface TravelPlan extends TravelPlanBasic {
  days: PlanDay[];
}

export type ExpenseCategory =
  | "transport"
  | "accommodation"
  | "food"
  | "entertainment"
  | "shopping"
  | "other";

export interface ExpenseRecord {
  id: number;
  plan_id: number;
  date: string; // ISO yyyy-mm-dd
  amount: number;
  category: ExpenseCategory;
  note?: string | null;
  input_method?: string | null; // e.g., text | voice
  created_at: string;
}