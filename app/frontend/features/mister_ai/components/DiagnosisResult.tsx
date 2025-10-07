import React from 'react';
import styled from '@emotion/styled';
import { Link } from '@inertiajs/react';
import { DiagnosisResult as DiagnosisResultType } from '../types/diagnosis';

const ResultContainer = styled.div`
  margin-top: 32px;
  padding: 32px;
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
  border-radius: 16px;
  border: 1px solid #e9ecef;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
`;

const ResultTitle = styled.h3`
  color: #35556c;
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 24px;
  text-align: center;
`;

const MetricsContainer = styled.div`
  display: flex;
  gap: 20px;
  margin-bottom: 24px;
  
  @media (max-width: 480px) {
    flex-direction: column;
    gap: 16px;
  }
`;

const MetricCard = styled.div<{ color: string }>`
  flex: 1;
  padding: 20px;
  background: ${props => props.color};
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
`;

const MetricValue = styled.div`
  font-size: 32px;
  font-weight: bold;
  color: white;
  margin-bottom: 8px;
  
  @media (max-width: 480px) {
    font-size: 28px;
  }
`;

const MetricLabel = styled.div`
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
`;

const DifficultyBadge = styled.span<{ level: string }>`
  display: inline-block;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 16px;
  font-weight: bold;
  color: white;
  color: ${props => {
    switch (props.level) {
      case 'easy': return '#28a745';
      case 'medium': return '#ffc107';
      case 'hard': return '#dc3545';
      default: return '#6c757d';
    }
  }};
`;

const ExplanationSection = styled.div`
  margin-bottom: 24px;
`;

const ExplanationTitle = styled.h4`
  color: #35556c;
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 12px;
`;

const ExplanationText = styled.div`
  font-size: 16px;
  line-height: 1.6;
  color: #555;
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  border-left: 4px solid #35556c;
`;

const RetryButton = styled(Link)`
  display: inline-block;
  background: #35556c;
  color: white;
  text-decoration: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  text-align: center;
  transition: all 0.2s ease;
  
  &:hover {
    background: #2a4557;
    color: white;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
`;

interface Props {
  result: DiagnosisResultType;
}

const getDifficultyText = (level: string) => {
  switch (level) {
    case 'easy': return '簡単';
    case 'medium': return '普通';
    case 'hard': return '困難';
    default: return '不明';
  }
};

export const DiagnosisResult: React.FC<Props> = ({ result }) => {
  return (
    <ResultContainer>
      <ResultTitle>AI診断結果</ResultTitle>
      
      <MetricsContainer>
        <MetricCard color="linear-gradient(135deg, #28a745, #20c997)">
          <MetricValue>{result.estimated_time_saving_rate}%</MetricValue>
          <MetricLabel>時間削減率</MetricLabel>
        </MetricCard>
        
        <MetricCard color="linear-gradient(135deg, #35556c, #4a6b7c)">
          <MetricValue>
            <DifficultyBadge level={result.difficulty_level}>
              {getDifficultyText(result.difficulty_level)}
            </DifficultyBadge>
          </MetricValue>
          <MetricLabel>実現難易度</MetricLabel>
        </MetricCard>
      </MetricsContainer>

      <ExplanationSection>
        <ExplanationTitle>💡 診断詳細</ExplanationTitle>
        <ExplanationText>{result.explanation}</ExplanationText>
      </ExplanationSection>
      
      <RetryButton href="/mister_ai">
        🔄 もう一度診断する
      </RetryButton>
    </ResultContainer>
  );
};