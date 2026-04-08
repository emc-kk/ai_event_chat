import asyncio
import json
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

from ...utils import (
    DatabaseConnection,
    get_topic_data,
    get_request_documents_by_ids,
    download_parsed_document,
    load_prompts,
    get_manual_by_request_id,
    update_manual_body,
    get_manual_template,
    get_llm,
)
from ..steps.data_acquisition_index import get_datasource_files_by_ids

PROMPTS = load_prompts()


async def _fetch_parsed_content_from_ds_files(db, data_source_file_ids: List[str]) -> str:
    """DataSourceFileのparsed_doc_keyからパース済みコンテンツを取得"""
    if not data_source_file_ids:
        return ""
    ds_files = await asyncio.to_thread(get_datasource_files_by_ids, db, data_source_file_ids)
    texts = []
    for dsf in ds_files:
        parsed_key = dsf.get('parsed_doc_key')
        if parsed_key:
            text = await asyncio.to_thread(download_parsed_document, parsed_key)
            if text:
                texts.append(text)
    return "\n\n".join(texts)


def _build_template_prompt(template: dict, topic_name: str, knowledge_data: str) -> str:
    """テンプレートの生成プロンプトから最終的なプロンプトを構築する"""
    sections = template.get('sections', [])
    if isinstance(sections, str):
        sections = json.loads(sections)

    sections_text = "\n".join(
        f"  {i+1}. **{s.get('name', '')}**: {s.get('instruction', '')}"
        for i, s in enumerate(sections)
    )

    generation_prompt = template.get('generation_prompt', '')
    if generation_prompt:
        # テンプレートの生成プロンプトの変数を置換
        prompt = generation_prompt.replace('{{topic_name}}', topic_name or "Not specified")
        prompt = prompt.replace('{{knowledge_data}}', knowledge_data)
        prompt = prompt.replace('{{sections}}', sections_text)
        return prompt

    # 生成プロンプトが未設定の場合はデフォルトのテンプレート適用プロンプト
    return f"""以下の暗黙知データを、指定されたセクション構造に従って文書化してください。

**トピック名**: {topic_name}

**セクション構造**:
{sections_text}

**暗黙知データ**:
{knowledge_data}

要件:
- 指定されたセクション構造に厳密に従うこと
- 各セクションの生成指示に従った内容を記述すること
- 日本語で出力すること
- Markdown形式で出力すること
"""


async def generate_manual_step(
    db: DatabaseConnection,
    request_id: str,
    topic_id: Optional[str],
    document_ids: List[str],
    data_source_file_ids: Optional[List[str]] = None,
) -> bool:
    logger.info("[START] Manual generation step")

    manual = await asyncio.to_thread(get_manual_by_request_id, db, request_id)
    if not manual:
        logger.error(f"Manual not found for request_id: {request_id}")
        return False

    parsed_content = ""

    # RequestDocuments（後方互換 + 動画）
    if document_ids:
        docs = await asyncio.to_thread(get_request_documents_by_ids, db, document_ids)
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

    # 既存マニュアル本文がある場合（動画追加時）、追加ソースとして含める
    existing_body = manual.get('body', '') or ''
    if existing_body.strip():
        parsed_content = f"[既存マニュアル内容]\n{existing_body}\n\n{parsed_content}"

    if not parsed_content or not parsed_content.strip():
        parsed_content = "No documents provided."

    topic_name = ""
    topic_description = ""
    if topic_id:
        topic_data = await asyncio.to_thread(get_topic_data, db, topic_id)
        if topic_data:
            topic_name = topic_data.get('name', '')
            topic_description = topic_data.get('description', '')

    input_text = manual.get('input_text', '') or ''
    if not input_text.strip():
        input_text = "No meeting notes or procedure information provided."

    # テンプレートが選択されている場合はテンプレートベースのプロンプトを使用
    template_id = manual.get('manual_template_id')
    template = None
    if template_id:
        template = await asyncio.to_thread(get_manual_template, db, template_id)
        if template:
            logger.info(f"Using template: {template.get('name', 'unknown')}")

    if template:
        # テンプレート適用: ドキュメント内容 + 入力テキストを knowledge_data として統合
        knowledge_data = f"{parsed_content}\n\n## 議事メモ・手順情報\n{input_text}"
        prompt = _build_template_prompt(template, topic_name, knowledge_data)
    else:
        # テンプレート未選択: 従来の固定フォーマットで生成（後方互換性）
        prompt_template = (
            PROMPTS
            .get('manual', {})
            .get('generation', {})
            .get('prompt', '')
        )
        if not prompt_template:
            logger.error("manual.generation.prompt not found in prompts.yml")
            return False

        prompt = prompt_template.format(
            topic_name=topic_name or "Not specified",
            topic_description=topic_description or "Not specified",
            document_content=parsed_content,
            input_text=input_text,
        )

    logger.info("Calling LLM for manual generation...")
    llm = get_llm()

    response = await asyncio.to_thread(llm.complete, prompt)
    generated_manual = response.text.strip()

    if not generated_manual:
        logger.error("LLM returned empty response")
        return False

    logger.info(f"Generated manual length: {len(generated_manual)} characters")

    success = await asyncio.to_thread(
        update_manual_body, db, manual['id'], generated_manual
    )

    if success:
        logger.info("[DONE] Manual generation step")
    else:
        logger.error("[FAILED] Manual generation step - could not save to database")

    return success
