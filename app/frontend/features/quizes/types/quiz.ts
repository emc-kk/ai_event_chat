export type IQuiz = {
  id: number;
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
}

export type Score = "S" | "A" | "B" | "C" | "D";

export type IRunking = {
  id: string;
  total: number;
  runking: number;
  score: Score;
}

export class QuizeImple {
  private _id: number;
  private _question: string;
  private _options: string[];
  private _correct_answer: string;
  private _explanation: string;
  private _userAnswer?: string;

  constructor(data: IQuiz) {
    this._id = data.id;
    this._question = data.question;
    this._options = data.options;
    this._correct_answer = data.correct_answer;
    this._explanation = data.explanation;
  }

  get id() {
    return this._id;
  }

  get question() {
    return this._question;
  }

  get options() {
    return this._options;
  }

  get correctAnswer() {
    return this._correct_answer;
  }

  get explanation() {
    return this._explanation;
  }

  get userAnswer() {
    return this._userAnswer;
  }

  addUserAnswer(answer: string) {
    this._userAnswer = answer;
  }

  isCorrect(): boolean {
    return this._userAnswer === this._correct_answer;
  }

  resetUserAnswer() {
    this._userAnswer = undefined;
  }
}