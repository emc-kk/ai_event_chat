import React from 'react';
import styled from '@emotion/styled';
import { DiagnosisResult as DiagnosisResultType } from '../types/diagnosis';

const ResultContainer = styled.div`
  margin-top: 32px;
  padding: 24px;
  background-color: #f8f9fa;
  border-radius: 12px;
  border: 1px solid #e9ecef;
`;

const ResultTitle = styled.h3`
  color: #35556c;
  font-size: 20px;
  margin-bottom: 16px;
`;

const SavingsText = styled.div`
  font-size: 24px;
  font-weight: bold;
  color: #28a745;
  margin-bottom: 16px;
`;

const ExplanationText = styled.div`
  font-size: 16px;
  line-height: 1.6;
  color: #333;
`;

interface Props {
  result: DiagnosisResultType;
}

export const DiagnosisResult: React.FC<Props> = ({ result }) => {
  return (
    <ResultContainer>
      <ResultTitle>診断結果</ResultTitle>
      <SavingsText>予想時間削減: {result.estimated_time_savings}</SavingsText>
      <ExplanationText>{result.explanation}</ExplanationText>
    </ResultContainer>
  );
};