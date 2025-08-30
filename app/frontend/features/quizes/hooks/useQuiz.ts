import { useState } from 'react';
import { IQuiz, QuizeImple } from '../types/quiz';

interface UseQuizProps {
  quizzes: IQuiz[];
}

export const useQuiz = ({ quizzes }: UseQuizProps) => {
  const _quizzes = quizzes.map(quiz => new QuizeImple(quiz));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  const currentQuiz = _quizzes[currentIndex];
  const isLastQuiz = currentIndex >= _quizzes.length - 1;

  const addAnswer = (selectedOption: string) => {
    currentQuiz.addUserAnswer(selectedOption);
    if (isLastQuiz) {
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
  };

  return {
    currentQuiz,
    currentIndex,
    isLastQuiz,
    isCompleted,
    totalQuizzes: quizzes.length,
    addAnswer,
    nextQuiz,
    resetQuiz,
    quizzes: _quizzes,
  };
};
