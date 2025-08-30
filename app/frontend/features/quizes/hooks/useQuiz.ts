import { useState, useRef, useEffect } from 'react';
import { IQuiz, QuizeImple } from '../types/quiz';

interface UseQuizProps {
  quizzes: IQuiz[];
}

export const useQuiz = ({ quizzes }: UseQuizProps) => {
  const _quizzes = quizzes.map(quiz => new QuizeImple(quiz));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completionTime, setCompletionTime] = useState<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const currentQuiz = _quizzes[currentIndex];
  const isLastQuiz = currentIndex >= _quizzes.length - 1;

  // クイズ開始時の時間を記録
  useEffect(() => {
    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }
  }, []);

  const addAnswer = (selectedOption: string) => {
    currentQuiz.addUserAnswer(selectedOption);
    if (isLastQuiz) {
      const endTime = Date.now();
      const timeElapsed = startTimeRef.current ? endTime - startTimeRef.current : 0;
      setCompletionTime(timeElapsed);
      setIsCompleted(true);
    }
  };

  const nextQuiz = () => {
    if (!isLastQuiz) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const resetQuiz = () => {
    _quizzes.forEach(quiz => quiz.resetUserAnswer());
    setCurrentIndex(0);
    setIsCompleted(false);
    setCompletionTime(null);
    startTimeRef.current = Date.now(); // 新しい開始時間を設定
  };

  return {
    currentQuiz,
    currentIndex,
    isLastQuiz,
    isCompleted,
    totalQuizzes: quizzes.length,
    completionTime,
    addAnswer,
    nextQuiz,
    resetQuiz,
    quizzes: _quizzes,
  };
};
