import styled from "@emotion/styled";
import { useState, useEffect } from "react";
import { Link } from "@inertiajs/react";
import { IAiWord } from "../../quizzes/types/ai_word";
import { Main } from "../../../components/ui/Main";
import bunner1 from "../../../assets/bunner_1.png";
import bunner2 from "../../../assets/bunner_2.png";
import bunner3 from "../../../assets/bunner_3.png";
import bunner4 from "../../../assets/bunner_4.png";

type Props = {
  words: IAiWord[];
}

const Container = styled(Main)`
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 16px;
`;

const Header = styled.div`
  display: flex;
  justify-content: center;
`;

const WordCardsContainer = styled.div`
  flex: 1;
  overflow-y: scroll;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 12px;
  margin: 12px;
  background-color: #FFFFFF;
  border-radius: 4px;
`;

const Title = styled.h1`
  color: #fff;
  font-size: 32px;
  font-weight: bold;
  text-align: center;
  line-height: 1;
  margin: 0;
`

const WordCard = styled.div`
  background-color: #fff;
  border: 1px solid #dddddda9;
  max-width: 400px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
`;

const CategoryHeader = styled.div`
  background-color: #e5e5e5;
  padding: 12px 16px;
  font-weight: bold;
  font-size: 14px;
  color: #333;
`;

const WordItem = styled.div<{ isExpanded: boolean }>`
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: #f8f8f8;
  }

  &:last-child {
    border-bottom: none;
    border-radius: 0 0 12px 12px;
  }
`;

const WordTitle = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
  font-size: 14px;
  color: #333;
`;

const ExpandIcon = styled.span<{ isExpanded: boolean }>`
  transform: ${props => props.isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'};
  transition: transform 0.2s ease;
  color: #666;
`;

const WordDescription = styled.div<{ isExpanded: boolean }>`
  margin-top: 8px;
  font-size: 12px;
  color: #666;
  line-height: 1.4;
  max-height: ${props => props.isExpanded ? '200px' : '0'};
  overflow: hidden;
  transition: max-height 0.3s ease;
`;

const BannerSection = styled.div`
  position: relative;
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
  padding: 0 12px;
  flex-shrink: 0;
`;

const BannerContainer = styled.div`
  background-color: #fff;
  border-radius: 8px;
  text-align: center;
  position: relative;
`;

const BannerImage = styled.img`
  width: 100%;
  height: 100px;
  object-fit: cover;
`;

const BannerLink = styled(Link)`
  display: block;
  text-decoration: none;
  transition: transform 0.1s ease;
  
  &:hover {
    transform: scale(1.01);
  }
`;

const NavigationDots = styled.div`
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 8px;
`;

const Dot = styled.div<{ active: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${props => props.active ? '#3270DE' : '#ddd'};
  transition: background-color 0.2s ease;
  cursor: pointer;
  
  &:hover {
    background-color: ${props => props.active ? '#3270DE' : '#bbb'};
  }
`;

export const Words = ({ words }: Props) => {
  const [expandedWords, setExpandedWords] = useState<Set<number>>(new Set());
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  const banners = [
    { image: bunner1, title: "バナー表示" },
    { image: bunner2, title: "バナー表示" },
    { image: bunner3, title: "バナー表示" },
    { image: bunner4, title: "バナー表示" }
  ];

  // 自動スライド機能
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 4000); // 4秒ごとに切り替え

    return () => clearInterval(interval);
  }, [banners.length]);

  // カテゴリごとにグループ化
  const groupedWords = words.reduce((acc, word) => {
    if (!acc[word.category]) {
      acc[word.category] = [];
    }
    acc[word.category].push(word);
    return acc;
  }, {} as Record<string, IAiWord[]>);

  const toggleWord = (wordId: number) => {
    const newExpanded = new Set(expandedWords);
    if (newExpanded.has(wordId)) {
      newExpanded.delete(wordId);
    } else {
      newExpanded.add(wordId);
    }
    setExpandedWords(newExpanded);
  };

  return (
    <Container>
      <Header>
        <Title>AI単語帳</Title>
      </Header>
      
      <WordCardsContainer>
        {Object.entries(groupedWords).map(([category, categoryWords]) => (
          <WordCard key={category}>
            <CategoryHeader>
              {Object.keys(groupedWords).indexOf(category) + 1}. {category}
            </CategoryHeader>
            {categoryWords.map((word) => {
              const isExpanded = expandedWords.has(word.id);
              return (
                <WordItem
                  key={word.id}
                  isExpanded={isExpanded}
                  onClick={() => toggleWord(word.id)}
                >
                  <WordTitle>
                    <span>{word.title}</span>
                    <ExpandIcon isExpanded={isExpanded}>▶</ExpandIcon>
                  </WordTitle>
                  <WordDescription isExpanded={isExpanded}>
                    {word.description}
                  </WordDescription>
                </WordItem>
              );
            })}
          </WordCard>
        ))}
      </WordCardsContainer>

      <BannerSection>
        <BannerContainer>
          <BannerLink href="">
            <BannerImage 
              src={banners[currentBannerIndex].image} 
              alt={`Banner ${currentBannerIndex + 1}`}
            />
          </BannerLink>
        </BannerContainer>
        <NavigationDots>
          {banners.map((_, index) => (
            <Dot 
              key={index} 
              active={index === currentBannerIndex}
              onClick={() => setCurrentBannerIndex(index)}
            />
          ))}
        </NavigationDots>
      </BannerSection>
    </Container>
  )
}