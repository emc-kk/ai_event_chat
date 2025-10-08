import styled from '@emotion/styled';
import { IRunking, QuizeImple } from '../types/quiz';
import { Link } from '@inertiajs/react';
import { Main } from '../../../components/ui/Main';
import lineQrCode from '../../../assets/line_qrcode.png';

type Props = {
  quizzes: QuizeImple[]
  runking: IRunking;
  completionTime: number | null;
}

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
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 90%;
  margin: 12px 0;
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

  &.S {
    color: #FFD700;
  }
  &.A {
    color: #FF4500;
  }
  &.B {
    color: #1E90FF
  }
  &.C {
    color: #32CD32;
  }
  &.D {
    color: #808080;
  }
`

const CorrectCount = styled.p`
  font-size: 14px;
  font-weight: bold;
  line-height: 1;
  color: #333;
  margin-bottom: 8px;
  &::first-letter {
    color: #2090FF;
  }
`

const Time = styled.p`
  font-size: 14px;
  font-weight: bold;
  line-height: 1;
  color: #333;
  margin-bottom: 4px;
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
  min-height: 400px;
  max-height: 400px;
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
  background-color: #3270DE;
  color: #fff;
  padding: 12px 32px;
  border-radius: 24px;
  border: none;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  width: 280px;
  text-align: center;
  margin: 12px 0;
`

const GotoLearnButton = styled.a`
  background-color: #3270DE;
  color: #fff;
  padding: 12px 32px;
  border-radius: 24px;
  border: none;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  width: 280px;
  text-align: center;
  margin: 12px 0;
  text-decoration: none;
  display: inline-block;
`;

const RunkingTable = styled.table`
  border-collapse: collapse;
  table-layout: fixed;
  width: 100%;
  max-width: 700px;
  text-align: center;
  font-size: 12px;

  & th, & td {
    border: 2px solid #d2e8f1;
    padding: 8px;
  }

  & thead th {
    background-color: #3270DE;
    color: #fff;
    border: 2px solid #4d9bc1;
    border-right: 2px solid #fff;
    border-bottom: 2px solid #fff;
  }

  & thead th:last-of-type {
    border-right: 2px solid #4d9bc1;
  }

  & tbody th {
    color: #4d9bc1;
    font-weight: bold;
    text-align: center;
  }
`;

const LineSection = styled(Section)`
  background: linear-gradient(135deg, #00C300, #00A300);
  color: white;
  text-align: center;
  padding: 20px;
`;

const LineSectionTitle = styled(ScoreTitle)`
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  margin-bottom: 16px;
`;

const LineQrImage = styled.img`
  width: 120px;
  height: 120px;
  border-radius: 12px;
  border: 3px solid white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  margin-bottom: 16px;
`;

const LineInstructionText = styled.p`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.95);
  line-height: 1.5;
  margin-bottom: 8px;
  font-weight: 500;
`;

const LineEmailInstruction = styled.p`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.4;
  background: rgba(255, 255, 255, 0.1);
  padding: 8px 12px;
  border-radius: 8px;
  margin-top: 12px;
`;

const formatTime = (ms: number) => {
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}分${secs}秒`;
}

export const Result: React.FC<Props> = ({ quizzes, runking, completionTime }) => {
  const correctCount = quizzes.filter(q => q.isCorrect()).length;
  const totalQuestions = quizzes.length;

  return (
    <Main>
      <Title>結果発表</Title>
      <Section>
        <ScoreTitle>あなたのAIレベル</ScoreTitle>
        <Score className={runking.score}>{runking.score}</Score>
        <CorrectCount>{correctCount} / {totalQuestions}問 正解</CorrectCount>
        {completionTime && <Time>タイム: {formatTime(completionTime)}</Time>}
        <Divider />
        <RunkingText><span>{runking.runking}</span>位 / {runking.total}人中</RunkingText>
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
      <GotoLearnButton href="/ai_words" target="_blank" rel="noopener noreferrer">自学勉強する</GotoLearnButton>
      <Section>
        <ScoreTitle>ランキング</ScoreTitle>
        <RunkingTable>
          <thead>
            <tr>
              <th>順位</th>
              <th>正解数</th>
              <th>タイム</th>
            </tr>
          </thead>
          <tbody>
            {runking.surrounding.map((entry, idx) => {
              const isCurrentUser = entry.id === runking.id;
              const currentUserIndex = runking.surrounding.findIndex(e => e.id === runking.id);
              const displayRanking = runking.runking - currentUserIndex + idx;
              return (
                <tr key={entry.id} style={{ backgroundColor: isCurrentUser ? '#F4CCCC' : 'transparent' }}>
                  <td>{displayRanking}</td>
                  <td>{entry.correct_count}問</td>
                  <td>{formatTime(entry.completion_time)}</td>
                </tr>
              )
            })}
          </tbody>
        </RunkingTable>
      </Section>
      <LineSection>
        <LineSectionTitle>📱 LINE友達追加でより詳しい結果をお送りします</LineSectionTitle>
        <LineQrImage src={lineQrCode} alt="LINE友達追加QRコード" />
        <LineInstructionText>
          上記QRコードを読み取って<br />
          LINE友達追加をお願いします
        </LineInstructionText>
        <LineEmailInstruction>
          LINE追加後、お手数ですが、LINEメッセージで<br />
          先程ご入力いただいたメールアドレスを送信してください
        </LineEmailInstruction>
      </LineSection>
      <RetryButton href="/quizzes">
        もう1回やる
      </RetryButton>
    </Main>
  );
}

