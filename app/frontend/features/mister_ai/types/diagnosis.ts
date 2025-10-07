export interface FormData {
  industry: string;
  problem: string;
  role: string;
  email: string;
}

export interface DiagnosisResult {
  estimated_time_saving_rate: number;
  difficulty_level: 'easy' | 'medium' | 'hard';
  explanation: string;
}