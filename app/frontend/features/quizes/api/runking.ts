import { IRunking } from "../types/quiz";

type Parameter = {
  completionTime: number;
  corretCount: number;
  answers: string[];
}

type Resoponse = IRunking;

export const patchRunking = async ({ completionTime, corretCount }: Parameter): Promise<Resoponse> => {
  const response = await fetch('/api/runking', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      completion_time: completionTime,
      correct_count: corretCount,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch runking data');
  }

  return response.json();
}