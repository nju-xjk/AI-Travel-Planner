export interface GenerateItineraryInput {
  origin: string;
  destination: string;
  start_date: string; // ISO yyyy-mm-dd
  end_date: string;   // ISO yyyy-mm-dd
  preferences?: Record<string, unknown> | null;
  // Optional inputs to guide generation
  party_size?: number;
  budget?: number | null;
}

export interface DaySegment {
  title: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  notes?: string;
  // Extended optional fields
  type?: 'transport' | 'accommodation' | 'food' | 'entertainment' | 'attraction' | 'shopping' | 'other';
  placeId?: string;
  costEstimate?: number;
  timeRange?: string;
}

export interface GeneratedItinerary {
  origin: string;
  destination: string;
  start_date: string;
  end_date: string;
  days: { day_index: number; segments: DaySegment[]; dayBudget?: number }[];
  // Optional fields predicted or echoed by the model
  budget?: number;
  party_size?: number;
}

export interface LLMClient {
  generateItinerary(input: GenerateItineraryInput): Promise<GeneratedItinerary>;
}