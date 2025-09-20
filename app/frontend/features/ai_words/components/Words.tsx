import styled from "@emotion/styled";
import { useState, useEffect, useRef, useCallback } from "react";
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
  padding: 16px 0;
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
  margin: 12px 0;
  background-color: #FFFFFF;
  border-radius: 4px;
  max-width: 380px;
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
  flex-shrink: 0;
`;

const ArrowButton = styled.button`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: #35556C;
  border: 1px solid #35556C;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #fff;
  cursor: pointer;
  z-index: 2;
  transition: all 0.2s ease;
  
  &:hover {
    background: #4a6b7a;
    border: 1px solid #4a6b7a;
    color: #fff;
    transform: translateY(-50%) scale(1.05);
  }
  
  &.left {
    left: 4px;
  }
  
  &.right {
    right: 4px;
  }
`;

const BannerContainer = styled.div`
  background-color: #fff;
  text-align: center;
  position: relative;
  overflow: hidden;
`;

const BannerSlider = styled.div<{ currentIndex: number }>`
  display: flex;
  width: ${props => props.currentIndex !== undefined ? '400%' : '400%'};
  transform: translateX(-${props => (props.currentIndex * 25)}%);
  transition: transform 0.5s ease-in-out;
`;

const BannerSlide = styled.div`
  width: 25%;
  flex-shrink: 0;
`;

const BannerImage = styled.img`
  width: 100%;
  height: 90px;
  object-fit: cover;
  display: block;
`;

const BannerLink = styled.a`
  display: block;
  text-decoration: none;
  transition: transform 0.1s ease;
  
  &:hover {
    transform: scale(1.01);
  }
`;

export const Words = ({ words }: Props) => {
  const [expandedWords, setExpandedWords] = useState<Set<number>>(new Set());
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const intervalRef = useRef<number | null>(null);

  const banners = [
    { image: bunner1, link: "" },
    { image: bunner2, link: "https://taiziii.com/skillrelay/" },
    { image: bunner3, link: "https://taiziii.com/contact/" },
    { image: bunner4, link: "" }
  ];

  // 自動スライド機能を開始する関数
  const startAutoSlide = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 4000); // 4秒ごとに切り替え
  }, [banners.length]);

  // 自動スライド機能
  useEffect(() => {
    startAutoSlide();
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [startAutoSlide]);

  // 矢印ボタンの操作
  const handlePrevBanner = () => {
    setCurrentBannerIndex((prev) => (prev - 1 + banners.length) % banners.length);
    startAutoSlide(); // タイマーを初期化
  };

  const handleNextBanner = () => {
    setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    startAutoSlide(); // タイマーを初期化
  };

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
        <ArrowButton className="left" onClick={handlePrevBanner}>
          &#8249;
        </ArrowButton>
        
        <BannerContainer>
          <BannerSlider currentIndex={currentBannerIndex}>
            {banners.map((banner, index) => (
              <BannerSlide key={index}>
                <BannerLink 
                  href={banner.link || "#"}
                  target={banner.link ? "_blank" : "_self"}
                  rel={banner.link ? "noopener noreferrer" : ""}
                >
                  <BannerImage 
                    src={banner.image} 
                    alt={`Banner ${index + 1}`}
                  />
                </BannerLink>
              </BannerSlide>
            ))}
          </BannerSlider>
        </BannerContainer>
        
        <ArrowButton className="right" onClick={handleNextBanner}>
          &#8250;
        </ArrowButton>
      </BannerSection>
    </Container>
  )
}