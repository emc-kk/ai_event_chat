import styled from '@emotion/styled';
import { IRunking, QuizeImple } from '../types/quiz';
import { Link } from '@inertiajs/react';

type Props = {
  quizzes: QuizeImple[]
  runking: IRunking;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background-color: #1b1a2d;
  padding: 20px;
`;

const Title = styled.h1`
  color: #fff;
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 24px;
  text-align: center;
  line-height: 1;
`

const Section = styled.div`
  background-color: #fff;
  padding: 12px;
  border-radius: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 90%;
  margin-bottom: 16px;
`

const ScoreTitle = styled.p`
  font-size: 12px;
  font-weight: bold;
  color: #929292;
  margin-bottom: 12px;
  line-height: 1;
`

const Score = styled.p`
  font-size: 56px;
  font-weight: bold;
  color: #2090FF;
  margin-bottom: 12px;
  line-height: 1;
`

const CorrectCount = styled.p`
  font-size: 14px;
  font-weight: bold;
  line-height: 1;
  color: #333;
  margin-bottom: 4px;
  &::first-letter {
    color: #2090FF;
  }
`

const Divider = styled.hr`
  width: 80%;
  border: none;
  border-top: 1px solid #eee;
  margin-bottom: 8px;
`

const RunkingText = styled.p`
  font-size: 12px;
  color: #666;
  & > {
    span {
      color: #2090FF;
    }
  }
`

const AnswerSection = styled(Section)`
  overflow-y: scroll;
  height: 400px;
  box-sizing: border-box;
  display: block;
  padding: 12px 20px;
`

const AnswersSectionTitle = styled.h3`
  font-size: 14px;
  font-weight: bold;
  color: #929292;
  margin-bottom: 16px;
  text-align: left;
`

const QuestionItem = styled.div`
  margin-bottom: 20px;
  &:last-child {
    margin-bottom: 0;
  }
`

const QuestionText = styled.p`
  font-size: 14px;
  font-weight: bold;
  color: #333;
  margin-bottom: 8px;
`

const Answer = styled.div<{ isCorrect: boolean }>`
  gap: 8px;
  margin-bottom: 12px;
  padding-left: 16px;
  font-weight: bold;
  font-size: 14px;
  position:  relative;
  color: ${props => props.isCorrect ? '#4CAF50' : '#F44336'};
  &::after {
    color: #929292;
    content: ${props => props.isCorrect ? '"✓"' : '"✗"'};
    position: absolute;
    top: 0;
    left: 0;
  }
`

const AnserDescription = styled.p`
  font-size: 12px;
  color: #666;
  margin-bottom: 16px;
`

const RetryButton = styled(Link)`
  background-color: #5c8edc;
  color: #fff;
  padding: 12px 32px;
  border-radius: 24px;
  border: none;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  width: 280px;
  text-align: center;
`


export const Result: React.FC<Props> = ({ quizzes, runking }) => {
  const correctCount = quizzes.filter(q => q.isCorrect()).length;
  const totalQuestions = quizzes.length;

  return (
    <Container>
      <Title>結果発表</Title>
      <Section>
        <ScoreTitle>あなたのAIレベル</ScoreTitle>
        <Score>{runking.scorre}</Score>
        <CorrectCount>{correctCount} / {totalQuestions}問 正解</CorrectCount>
        <Divider />
        <RunkingText><span>{runking.correct}</span>位 / {runking.total}人中</RunkingText>
      </Section>
      <AnswerSection>
        <AnswersSectionTitle>答え合わせ</AnswersSectionTitle>
        {quizzes.map((quiz, index) => {
          const isCorrect = quiz.isCorrect();
          
          return (
            <>
              <QuestionItem key={quiz.id}>
                <QuestionText>
                  第{index + 1}問: {quiz.question}
                </QuestionText>
                <Answer isCorrect={isCorrect}>{!isCorrect && "不"}正解: {quiz.userAnswer}</Answer>
                <AnserDescription>
                  {!isCorrect && `正解は「${quiz.correctAnswer}」です。`}
                  {quiz.explanation}
                </AnserDescription>
              </QuestionItem>
              <Divider />
            </>
          );
        })}
      </AnswerSection>
      <RetryButton href="/quizzes">
        もう1回やる
      </RetryButton>
    </Container>
  );
}

