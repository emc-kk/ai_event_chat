import React, { useState } from 'react';
import styled from '@emotion/styled';
import { FormData } from '../types/diagnosis';

const FormContainer = styled.div`
  width: 100%;
  max-width: 500px;
`;

const FormGroup = styled.div`
  margin-bottom: 24px;
`;

const Label = styled.label`
  display: block;
  font-weight: bold;
  color: #35556c;
  margin-bottom: 8px;
  font-size: 16px;
`;

const Input = styled.input`
  width: 100%;
  font-size: 16px;
  padding: 12px 16px;
  border: 2px solid #ddd;
  border-radius: 8px;
  box-sizing: border-box;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #35556c;
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  font-size: 16px;
  padding: 12px 16px;
  border: 2px solid #ddd;
  border-radius: 8px;
  box-sizing: border-box;
  min-height: 120px;
  resize: vertical;
  font-family: inherit;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #35556c;
  }
`;

const Button = styled.button`
  width: 100%;
  background: #35556c;
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-top: 16px;

  &:hover {
    background: #2a4557;
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
`;

interface Props {
  onSubmit: (data: Pick<FormData, 'industry' | 'problem' | 'role' | 'email'>) => void;
}

export const DiagnosisForm: React.FC<Props> = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    industry: '',
    problem: '',
    role: '',
    email: ''
  });

  const handleInputChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
  };

  const isFormValid = () => {
    return formData.industry.trim() && formData.problem.trim() && formData.role.trim();
  };

  const handleSubmit = () => {
    if (isFormValid()) {
      onSubmit(formData);
    }
  };

  return (
    <FormContainer>
      <FormGroup>
        <Label>業種</Label>
        <Input
          type="text"
          value={formData.industry}
          onChange={handleInputChange('industry')}
          placeholder="例: 製造業、IT業界、小売業など"
        />
      </FormGroup>

      <FormGroup>
        <Label>課題</Label>
        <TextArea
          value={formData.problem}
          onChange={handleInputChange('problem')}
          placeholder="現在抱えている業務課題を具体的にご記入ください"
        />
      </FormGroup>

      <FormGroup>
        <Label>役割</Label>
        <Input
          type="text"
          value={formData.role}
          onChange={handleInputChange('role')}
          placeholder="例: 営業担当、品質管理担当、事務員など"
        />
      </FormGroup>

      <Button onClick={handleSubmit} disabled={!isFormValid()}>
        次へ
      </Button>
    </FormContainer>
  );
};