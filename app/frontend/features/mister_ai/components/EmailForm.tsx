import React, { useState } from 'react';
import styled from '@emotion/styled';

const FormContainer = styled.div`
  width: 100%;
  max-width: 500px;
`;

const ProgressMessage = styled.div`
  background: linear-gradient(135deg, #35556c, #4a6b7c);
  color: white;
  padding: 20px;
  border-radius: 12px;
  text-align: center;
  margin-bottom: 32px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
`;

const ProgressTitle = styled.h3`
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: bold;
`;

const ProgressSubtitle = styled.p`
  margin: 0;
  font-size: 16px;
  opacity: 0.9;
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

  &.error {
    border-color: #dc3545;
  }
`;

const ErrorText = styled.div`
  color: #dc3545;
  font-size: 14px;
  margin-top: 4px;
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
  onEmailSubmit: (email: string) => void;
  loading?: boolean;
}

export const EmailForm: React.FC<Props> = ({ onEmailSubmit, loading = false }) => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateEmail = (value: string) => {
    if (!value.trim()) {
      return 'メールアドレスは必須です';
    }
    if (!isValidEmail(value)) {
      return '正しいメールアドレスの形式で入力してください';
    }
    return '';
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setEmailError(validateEmail(value));
  };

  const handleSubmit = () => {
    const error = validateEmail(email);
    if (error) {
      setEmailError(error);
      return;
    }
    onEmailSubmit(email);
  };

  const isFormValid = email.trim() && isValidEmail(email) && !emailError;

  return (
    <FormContainer>
      <ProgressMessage>
        <ProgressTitle>🎉 もう少しで診断完了！</ProgressTitle>
        <ProgressSubtitle>最後にメールアドレスをご入力ください</ProgressSubtitle>
      </ProgressMessage>

      <FormGroup>
        <Label>メールアドレス</Label>
        <Input
          type="email"
          value={email}
          onChange={handleEmailChange}
          placeholder="例: your-email@example.com"
          className={emailError ? 'error' : ''}
          disabled={loading}
        />
        {emailError && <ErrorText>{emailError}</ErrorText>}
      </FormGroup>

      <Button onClick={handleSubmit} disabled={!isFormValid || loading}>
        {loading ? 'AI診断中...' : 'AI診断を開始'}
      </Button>
    </FormContainer>
  );
};