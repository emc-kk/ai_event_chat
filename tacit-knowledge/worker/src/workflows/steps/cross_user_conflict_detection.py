import asyncio
import json
import logging
from typing import List, Dict, Any, Optional

from ulid import ULID
from llama_index.core.llms import ChatMessage
from llama_index.core.prompts import ChatPromptTemplate

logger = logging.getLogger(__name__)

from ...utils import (
    DatabaseConnection,
    get_hearing_qa_by_request_id,
    get_embed_model,
    get_llm,
)


def _get_completed_request_ids_for_topic(
    db: DatabaseConnection,
    topic_id: str,
    exclude_request_id: str,
) -> List[str]:
    """同一トピック内の完了済み（かつ除外対象でない）リクエストIDを取得"""
    try:
        query = """
            SELECT id FROM requests
            WHERE topic_id = %s
              AND id != %s
              AND status = 5
              AND deleted_at IS NULL
        """
        results = db.execute_query(query, (topic_id, exclude_request_id), fetch=True)
        return [row['id'] for row in results] if results else []
    except Exception as e:
        logger.error(f"Error getting completed request IDs: {e}")
        return []


def _compute_similarity(embed_model, text_a: str, text_b: str) -> float:
    """2つのテキスト間のコサイン類似度を計算"""
    try:
        embeddings = embed_model.get_text_embedding_batch([text_a, text_b])
        if len(embeddings) < 2:
            return 0.0

        vec_a = embeddings[0]
        vec_b = embeddings[1]

        dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
        norm_a = sum(a * a for a in vec_a) ** 0.5
        norm_b = sum(b * b for b in vec_b) ** 0.5

        if norm_a == 0 or norm_b == 0:
            return 0.0

        return dot_product / (norm_a * norm_b)
    except Exception as e:
        logger.error(f"Error computing similarity: {e}")
        return 0.0


def _check_contradiction_with_llm(
    llm,
    question_a: str,
    answer_a: str,
    question_b: str,
    answer_b: str,
) -> bool:
    """LLMで2つのQAペアが矛盾しているか判定"""
    try:
        prompt = f"""以下の2つのQAペアが矛盾しているか判定してください。
同じトピックについて異なるユーザーから得られた回答です。

## QAペア A
質問: {question_a}
回答: {answer_a}

## QAペア B
質問: {question_b}
回答: {answer_b}

## 判定基準
- 2つの回答が同じ事柄について異なる結論・方針・手順を述べている場合は「矛盾あり」
- 回答が補完的（一方が詳しく、他方が簡潔など）な場合は「矛盾なし」
- 回答が異なる側面について述べている場合は「矛盾なし」

「矛盾あり」の場合は "CONFLICT" とだけ回答してください。
「矛盾なし」の場合は "NO_CONFLICT" とだけ回答してください。"""

        chat_prompt_tmpl = ChatPromptTemplate(
            message_templates=[
                ChatMessage.from_str(prompt, role="user"),
            ]
        )

        response = llm.chat(
            [ChatMessage.from_str(prompt, role="user")]
        )

        result_text = response.message.content.strip().upper()
        return "CONFLICT" in result_text and "NO_CONFLICT" not in result_text
    except Exception as e:
        logger.error(f"Error checking contradiction with LLM: {e}")
        return False


def _save_conflicts(
    db: DatabaseConnection,
    conflicts: List[Dict[str, Any]],
    topic_id: str,
) -> int:
    """矛盾をDBに保存"""
    saved_count = 0
    for conflict in conflicts:
        try:
            conflict_id = str(ULID())
            query = """
                INSERT INTO cross_user_conflicts
                    (id, topic_id, request_a_id, request_b_id,
                     question_a, answer_a, question_b, answer_b,
                     similarity, status, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', NOW(), NOW())
            """
            db.execute_query(query, (
                conflict_id,
                topic_id,
                conflict['request_a_id'],
                conflict['request_b_id'],
                conflict['question_a'],
                conflict['answer_a'],
                conflict['question_b'],
                conflict['answer_b'],
                conflict['similarity'],
            ))
            saved_count += 1
        except Exception as e:
            logger.error(f"Error saving conflict: {e}")
    return saved_count


async def detect_cross_user_conflicts(
    db: DatabaseConnection,
    request_id: str,
    topic_id: str,
    similarity_threshold: float = 0.80,
) -> List[Dict[str, Any]]:
    """
    クロスユーザー矛盾検出

    1. 今回完了したリクエストのQAデータを取得
    2. 同一トピック内の他の完了済みリクエストのQAを取得
    3. embedding類似度で類似質問ペアを特定
    4. 高類似度ペアに対してLLMで矛盾判定
    5. 矛盾があればcross_user_conflictsテーブルに保存
    """
    logger.info(f"[START] Cross-user conflict detection for request {request_id}")

    # 1. 今回のリクエストのQAを取得
    current_qa = await asyncio.to_thread(
        get_hearing_qa_by_request_id, db, request_id
    )
    if not current_qa:
        logger.info("[SKIP] No QA data for current request")
        return []

    # 2. 同一トピック内の他の完了済みリクエストを取得
    other_request_ids = await asyncio.to_thread(
        _get_completed_request_ids_for_topic, db, topic_id, request_id
    )
    if not other_request_ids:
        logger.info("[SKIP] No other completed requests in topic")
        return []

    # 他のリクエストのQAを取得
    other_qa_map: Dict[str, List[Dict[str, Any]]] = {}
    for other_id in other_request_ids:
        qa = await asyncio.to_thread(
            get_hearing_qa_by_request_id, db, other_id
        )
        if qa:
            other_qa_map[other_id] = qa

    if not other_qa_map:
        logger.info("[SKIP] No QA data for other requests")
        return []

    # 3. embedding類似度で類似質問ペアを特定
    embed_model = get_embed_model()
    llm = get_llm()
    conflicts: List[Dict[str, Any]] = []

    for current_item in current_qa:
        for other_req_id, other_qa_list in other_qa_map.items():
            for other_item in other_qa_list:
                similarity = await asyncio.to_thread(
                    _compute_similarity,
                    embed_model,
                    current_item['question'],
                    other_item['question'],
                )

                if similarity < similarity_threshold:
                    continue

                # 4. LLMで矛盾判定
                is_conflict = await asyncio.to_thread(
                    _check_contradiction_with_llm,
                    llm,
                    current_item['question'],
                    current_item['answer'],
                    other_item['question'],
                    other_item['answer'],
                )

                if is_conflict:
                    conflicts.append({
                        'request_a_id': request_id,
                        'request_b_id': other_req_id,
                        'question_a': current_item['question'],
                        'answer_a': current_item['answer'],
                        'question_b': other_item['question'],
                        'answer_b': other_item['answer'],
                        'similarity': similarity,
                    })

    # 5. 矛盾があればDBに保存
    if conflicts:
        saved = await asyncio.to_thread(
            _save_conflicts, db, conflicts, topic_id
        )
        logger.info(f"[DONE] Found and saved {saved} cross-user conflicts")
    else:
        logger.info("[DONE] No cross-user conflicts detected")

    return conflicts
