import { IRunking } from "../types/quiz";

type Parameter = {
  completionTime: number;
  corretCount: number;
  answers: string[];
}

type Resoponse = IRunking;

const getCSRFToken = (): string => {
  const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  if (!token) {
    throw new Error('CSRF token not found');
  }
  return token;
};

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