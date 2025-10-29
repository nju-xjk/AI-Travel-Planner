export interface GenerateItineraryInput {
  destination: string;
  start_date: string; // ISO yyyy-mm-dd
  end_date: string;   // ISO yyyy-mm-dd
  preferences?: Record<string, unknown> | null;
}

export interface DaySegment {
  title: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  notes?: string;
}

export interface GeneratedItinerary {
  destination: string;
  start_date: string;
  end_date: string;
  days: { day_index: number; segments: DaySegment[] }[];
}

export interface LLMClient {
  generateItinerary(input: GenerateItineraryInput): Promise<GeneratedItinerary>;
}