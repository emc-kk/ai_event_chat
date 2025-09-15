import { Head, Link } from '@inertiajs/react';
import styled from '@emotion/styled';
import { Layaout } from '../components/layouts/layout';
import { Main } from '../components/ui/Main';
import { TitleSet } from '../components/ui/TitleSet';

const GotoButton = styled(Link)`
  background-color: #3A7BE8;
  width: 300px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  border-radius: 24px;
`

const RuleContainer = styled.div`
  background-color: #E6EEFB;
  padding: 8px 32px;
  margin-bottom: 24px;
  border-radius: 8px;
  width: 80%;
`

const RuleTitle = styled.h2`
  font-size: 20px;
  font-weight: bold;
  text-align: center;
`;

const RuleList = styled.ul`
  font-size: 12px;
  list-style-type: disc;
`;

const SubRuleList = styled.ul`
  margin-bottom: 8px;
  padding-left: 12px;
  list-style-type: decimal;
`;

export default function Home() {
  return (
    <Layaout>
      <Head title="AIクイズ" />
      <Main>
        <TitleSet />
        <RuleContainer>
          <RuleTitle>ルール説明</RuleTitle>
          <RuleList>
            <li>ルール
              <SubRuleList>
                <li>あなたのAI力をチェック！4択のクイズを全10問出題します！</li>
                <li>解答後に、あなたのAIレベルとランキンが発表されます！</li>
                <li>何度でも挑戦できるので、ランキング上位を目指しましょう！</li>
                <li>ランキングは点数優先 + タイムアタック方式！</li>
                <li>同点なら...スピード勝負！解答が早い人が勝ち抜けます！</li>
              </SubRuleList>
            </li>
            <li>AIレベル判定
              <SubRuleList>
                <li>Sランク: 9-10問正解</li>
                <li>Aランク: 7-8問正解</li>
                <li>Bランク: 5-6問正解</li>
                <li>Cランク: 3-4問正解</li>
                <li>Dランク: 0-2問正解</li>
              </SubRuleList>
            </li>
          </RuleList>
        </RuleContainer>
        <GotoButton href="/quizzes">診断スタート</GotoButton>
      </Main>
    </Layaout>
  )
}