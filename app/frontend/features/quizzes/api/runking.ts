import { getCSRFToken } from "../../../lib/api";
import { IRunking } from "../types/quiz";

type Parameter = {
  completionTime: number;
  corretCount: number;
  answers: string[];
}

type Resoponse = IRunking;

export const postRunking = async ({ completionTime, corretCount, answers }: Parameter): Promise<Resoponse> => {
  const response = await fetch('/api/runkings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCSRFToken()
    },
    body: JSON.stringify({
      completion_time: completionTime,
      correct_count: corretCount,
      answers
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch runking data');
  }

  return response.json();
}