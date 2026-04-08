from typing import List
from pydantic import BaseModel, Field


class StarChartRow(BaseModel):
    question: str = Field(..., description="質問（元の質問を参考にしつつ、状況に応じて適切にまとめられた質問）")
    keyword_category: str = Field(..., description="条件1: キーワード/カテゴリ")
    question_intent: str = Field(..., description="条件2: 質問の意図")
    related_situation: str = Field(..., description="条件3: 関連する状況（1つの質問・回答ペアから複数の状況を抽出可能）")
    answer: str = Field(..., description="回答（質問に対する回答をまとめたもの）")

class StarChartResponse(BaseModel):
    rows: List[StarChartRow] = Field(..., description="星取り表の行リスト")


class KnowledgeQaRow(BaseModel):
    question: str = Field(..., description="質問（元の質問を参考にしつつ、状況に応じて適切にまとめられた質問）")
    keyword_category: str = Field(..., description="条件1: キーワード/カテゴリ")
    question_intent: str = Field(..., description="条件2: 質問の意図")
    related_situation: str = Field(..., description="条件3: 関連する状況（1つの質問・回答ペアから複数の状況を抽出可能）")
    answer: str = Field(..., description="回答（質問に対する回答をまとめたもの）")


class KnowledgeQaResponse(BaseModel):
    rows: List[KnowledgeQaRow] = Field(..., description="ナレッジQAの行リスト")


class ChapterRow(BaseModel):
    sequence: int = Field(..., description="チャプターの表示順（1から開始）")
    start_second: float = Field(..., description="開始時間（秒）")
    end_second: float = Field(..., description="終了時間（秒）")
    title: str = Field(..., description="チャプタータイトル（20文字以内）")
    description: str = Field(..., description="チャプターの説明（100文字以内）")


class ChapterResponse(BaseModel):
    chapters: List[ChapterRow] = Field(..., description="チャプターリスト")

