import styled from "@emotion/styled";
import { useState, useRef } from "react";

type Props = {
  onEmailSubmit: (email: string) => void;
};

const EmailInput = styled.input`
  background-color: #fff;
  border: 2px solid #5c8edc;
  border-radius: 4px;
  padding: 12px 24px;
  font-size: clamp(14px, 3.5vw, 16px);
  width: 100%;
  max-width: 90vw;
  min-width: 280px;
  text-align: center;
  outline: none;
  margin-bottom: 20px;

  &:focus {
    border-color: #4a7bc8;
    box-shadow: 0 0 0 2px rgba(92, 142, 220, 0.2);
  }

  &::placeholder {
    color: #999;
  }

  @media (min-width: 400px) {
    max-width: 350px;
  }
`;

const SubmitButton = styled.button`
  background-color: #5c8edc;
  width: 100%;
  max-width: 90vw;
  min-width: 280px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  border-radius: 24px;
  border: none;
  cursor: pointer;
  font-size: clamp(14px, 3.5vw, 16px);
  font-weight: bold;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: #4a7bc8;
  }

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
  
  @media (min-width: 400px) {
    max-width: 350px;
  }
`;

export const EmailForm: React.FC<Props> = ({ onEmailSubmit }) => {
  const [email, setEmail] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const trimmedEmail = email.trim();
    onEmailSubmit(trimmedEmail);
  };

  return (
    <>
      <EmailInput
        ref={emailRef}
        type="email"
        placeholder="メールアドレスを入力してください"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoFocus
      />
      <SubmitButton 
        onClick={handleSubmit}
      >
        結果を見る
      </SubmitButton>
    </>
  );
};