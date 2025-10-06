import { getCSRFToken } from "../../../lib/api";

export interface DiagnosisRequest {
  industry: string;
  problem: string;
  role: string;
  email?: string;
}

export interface DiagnosisResult {
  estimated_time_savings: string;
  explanation: string;
}

interface DiagnosisResponse {
  success: boolean;
  estimated_time_savings?: string;
  explanation?: string;
  error?: string;
}

export const postDiagnosis = async (data: DiagnosisRequest): Promise<DiagnosisResult> => {
  const response = await fetch('/api/mister_ai/diagnose', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCSRFToken()
    },
    body: JSON.stringify(data),
  });

  const responseData: DiagnosisResponse = await response.json();

  if (!response.ok || !responseData.success) {
    throw new Error(responseData.error || 'Failed to diagnose');
  }

  return {
    estimated_time_savings: responseData.estimated_time_savings!,
    explanation: responseData.explanation!
  };
};