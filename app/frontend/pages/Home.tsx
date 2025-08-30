import { Head, Link } from '@inertiajs/react';
import styled from '@emotion/styled';
import { Layaout } from '../components/layouts/layout';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background-color: #f5f5f5;
`;

const Title = styled.h1`
  font-size: 32px;
  font-weight: bold;
  color: #333;
  margin-bottom: 42px;
`;

const Description = styled.p`
  color: #333;
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 12px;
`;

const GotoButton = styled(Link)`
  background-color: #5C8EDC;
  width: 300px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  border-radius: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
`

export default function Home() {
  return (
    <Layaout>
      <Head title="AIレベル診断クイズ" />
      <Container>
        <Title>AIレベル診断クイズ</Title>
        <Description>ホイールを止めてあなたの知識をためそう！</Description>
        <GotoButton href="/quizzes">診断スタート</GotoButton>
      </Container>
    </Layaout>
  )
}