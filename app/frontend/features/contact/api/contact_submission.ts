import { getCSRFToken } from "../../../lib/api";

type Parameter = {
  companyName: string;
  email: string;
  interestedServices: string[];
  serviceIds: string[];
}

export const postContactSubmission = async ({companyName, email, interestedServices, serviceIds}: Parameter): Promise<any> => {
  const response = await fetch('/api/contact_submissions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCSRFToken()
    },
    body: JSON.stringify({
      company_name: companyName,
      email,
      interested_services: interestedServices,
      service_ids: serviceIds
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch contact submission data');
  }

  return response.json();
}