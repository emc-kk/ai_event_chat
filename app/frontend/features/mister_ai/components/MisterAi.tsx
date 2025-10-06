import React, { useState } from 'react';
import styled from '@emotion/styled';
import { Main } from '../../../components/ui/Main';
import { Title } from '../../../components/ui/Title';
import { DiagnosisForm } from './DiagnosisForm';
import { EmailForm } from './EmailForm';
import { DiagnosisResult } from './DiagnosisResult';
import { postDiagnosis } from '../api/diagnosis';
import { FormData, DiagnosisResult as DiagnosisResultType } from '../types/diagnosis';

const Container = styled(Main)`
  background-color: #fff;
  padding: 20px;
  justify-content: flex-start;
  max-width: 600px;
`;

const TitleC = styled(Title)`
  color: #35556c;
  background-color: transparent;
  border-radius: 0;
  font-size: 42px;
  font-weight: bold;
  text-align: center;
  margin-bottom: 8px;
  line-height: 1;
`;

const Description = styled.p`
  color: #35556c;
  font-size: 12px;
  text-align: center;
  margin-bottom: 24px;
`;

const ErrorMessage = styled.div`
  color: #dc3545;
  font-size: 16px;
  text-align: center;
  margin-top: 16px;
`;

const LoadingMessage = styled.div`
  color: #35556c;
  font-size: 16px;
  text-align: center;
  margin-top: 16px;
`;

export const MisterAi: React.FC = () => {
  const [formData, setFormData] = useState<Pick<FormData, 'industry' | 'problem' | 'role'>>({
    industry: '',
    problem: '',
    role: ''
  });
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [result, setResult] = useState<DiagnosisResultType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleBasicFormSubmit = (data: Pick<FormData, 'industry' | 'problem' | 'role'>) => {
    setFormData(data);
    setShowEmailForm(true);
  };

  const handleEmailSubmit = async (email: string) => {
    setLoading(true);
    setError('');

    try {
      const result = await postDiagnosis({
        industry: formData.industry,
        problem: formData.problem,
        role: formData.role,
        email: email
      });

      setResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ネットワークエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <Container>
        <TitleC>ミスターAI</TitleC>
        <DiagnosisResult result={result} />
      </Container>
    );
  }

  if (showEmailForm) {
    return (
      <Container>
        <TitleC>ミスターAI</TitleC>
        <EmailForm onEmailSubmit={handleEmailSubmit} loading={loading} />
        {error && <ErrorMessage>{error}</ErrorMessage>}
        {loading && <LoadingMessage>AI が診断中です...</LoadingMessage>}
      </Container>
    );
  }

  return (
    <Container>
      <TitleC>ミスターAI</TitleC>
      <Description>AIで業務を効率化しましょう</Description>
      <DiagnosisForm onSubmit={handleBasicFormSubmit} />
    </Container>
  );
};