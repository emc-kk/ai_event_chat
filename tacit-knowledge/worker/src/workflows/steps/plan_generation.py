import asyncio
import logging
from typing import List, Optional, Dict, Any

logger = logging.getLogger(__name__)

from ...utils import (
    DatabaseConnection,
    get_request_data,
    get_topic_data,
    get_request_content_comment,
    get_request_documents_by_ids,
    download_parsed_document,
    load_prompts,
    get_hearing_qa_by_request_id,
    get_llm,
)
from .manual_generation import _fetch_parsed_content_from_ds_files

PROMPTS = load_prompts()


def _format_qa_for_prompt(qa_rows: List[Dict[str, Any]]) -> str:
    if not qa_rows:
        return "No previous hearing QA available."

    formatted = []
    for idx, row in enumerate(qa_rows, 1):
        question = row.get('question', '')
        answer = row.get('answer', '')
        keyword_category = row.get('keyword_category', '')
        question_intent = row.get('question_intent', '')
        related_situation = row.get('related_situation', '')

        section = f"## QA {idx}\n"
        section += f"**Question**: {question}\n"
        section += f"**Answer**: {answer}\n"
        if keyword_category:
            section += f"**Category**: {keyword_category}\n"
        if question_intent:
            section += f"**Intent**: {question_intent}\n"
        if related_situation:
            section += f"**Related Situation**: {related_situation}\n"

        formatted.append(section)

    return "\n---\n\n".join(formatted) if formatted else "No previous hearing QA available."


def _get_previous_plans(db: DatabaseConnection, request_id: str) -> List[Dict[str, Any]]:
    try:
        query = """
            SELECT id, context, created_at
            FROM request_contents
            WHERE request_id = %s AND context IS NOT NULL
            ORDER BY created_at ASC
        """
        results = db.execute_query(query, (request_id,), fetch=True)
        return [dict(row) for row in results] if results else []
    except Exception as e:
        logger.error(f"Error getting previous plans: {e}")
        return []


def _format_previous_plans_for_prompt(plans: List[Dict[str, Any]]) -> str:
    if not plans:
        return "No previous hearing plans available."

    formatted = []
    for idx, plan in enumerate(plans, 1):
        context = plan.get('context', '')
        if context:
            section = f"## Hearing Plan {idx}\n{context}"
            formatted.append(section)

    return "\n\n---\n\n".join(formatted) if formatted else "No previous hearing plans available."


async def generate_plan_step(
    db: DatabaseConnection,
    document_ids: List[str],
    request_id: str,
    topic_id: Optional[str],
    next_status: str,
    request_content_id: Optional[str],
    data_source_file_ids: Optional[List[str]] = None,
) -> str:
    logger.info("[START] Plan generation step")

    llm = get_llm()

    parsed_content = ""
    # RequestDocuments（後方互換）
    if document_ids:
        docs = await asyncio.to_thread(
            get_request_documents_by_ids, db, document_ids
        )
        texts = []
        for doc in docs:
            parsed_key = doc.get('parsed_document_key')
            if parsed_key:
                text = await asyncio.to_thread(download_parsed_document, parsed_key)
                if text:
                    texts.append(text)
        parsed_content = "\n\n".join(texts)

    # DataSourceFiles（新パス）
    ds_content = await _fetch_parsed_content_from_ds_files(db, data_source_file_ids or [])
    if ds_content:
        parsed_content = f"{parsed_content}\n\n{ds_content}" if parsed_content else ds_content

    if not parsed_content or not parsed_content.strip():
        parsed_content = "提供資料はありません。"

    request_data = await asyncio.to_thread(
        get_request_data, str(request_id), False
    )
    request_name = request_data.get('name', '') if request_data else ''
    request_description = request_data.get('description', '') if request_data else ''

    topic_name = ""
    topic_description = ""
    if topic_id:
        topic_data = await asyncio.to_thread(
            get_topic_data, db, topic_id
        )
        if topic_data:
            topic_name = topic_data.get('name', '')
            topic_description = topic_data.get('description', '')
        elif request_data:
            topic_name = request_data.get('topic', {}).get('name', '')
            topic_description = request_data.get('topic', {}).get('description', '')
    elif request_data:
        topic_name = request_data.get('topic', {}).get('name', '')
        topic_description = request_data.get('topic', {}).get('description', '')

    generated_plan = ""

    if next_status == 'not_started':
        prompt_template = (
            PROMPTS
            .get('plan', {})
            .get('generation', {})
            .get('initial', '')
        )

        if not prompt_template:
            logger.warning("plan.generation.initial prompt not found")
            return ""

        prompt = prompt_template.format(
            request_name=request_name or "",
            request_description=request_description or "",
            topic_name=topic_name or "",
            topic_description=topic_description or "",
            document_content=parsed_content,
        )

        response = await asyncio.to_thread(llm.complete, prompt)
        generated_plan = response.text.strip()

    elif next_status == 'rehearing' and request_content_id:
        prompt_template = (
            PROMPTS
            .get('plan', {})
            .get('generation', {})
            .get('rehearing', '')
        )
        if not prompt_template:
            logger.warning("plan.generation.rehearing prompt not found")
            return ""

        previous_plans = await asyncio.to_thread(
            _get_previous_plans, db, request_id
        )
        previous_plans_text = _format_previous_plans_for_prompt(previous_plans)

        previous_qa = await asyncio.to_thread(
            get_hearing_qa_by_request_id, db, request_id
        )
        previous_qa_text = _format_qa_for_prompt(previous_qa)

        new_comment = await asyncio.to_thread(
            get_request_content_comment, db, request_content_id
        )
        if not new_comment:
            new_comment = "新しいコメントはありません。"

        prompt = prompt_template.format(
            request_name=request_name or "",
            request_description=request_description or "",
            topic_name=topic_name or "",
            topic_description=topic_description or "",
            previous_plans=previous_plans_text,
            previous_qa=previous_qa_text,
            new_comment=new_comment
        )

        response = await asyncio.to_thread(llm.complete, prompt)
        generated_plan = response.text.strip()

    else:
        logger.warning(f"Plan generation skipped for next_status: {next_status}")

    logger.info("[DONE] Plan generation step")
    return generated_plan
