import asyncio
import shutil
import logging
from typing import Any, Dict, Optional, List

from pydantic import Field
from llama_index.core.workflow import Workflow, step, Event, StartEvent, StopEvent

logger = logging.getLogger(__name__)

from ..utils import (
    DatabaseConnection,
    create_or_update_request_content,
    get_latest_request_content_id,
    get_manual_by_request_id,
)
from .steps.document_parse import document_parse_step
from .steps.video_encoding import video_encoding_step
from .steps.document_index import document_index_step
from .steps.plan_generation import generate_plan_step
from .steps.qa_generation import generate_qa_step
from .steps.cross_user_conflict_detection import detect_cross_user_conflicts
from .steps.manual_generation import generate_manual_step


class DocumentParsedEvent(Event):
    document_ids: List[str] = Field(default_factory=list, description="request_documents.idの配列")
    data_source_file_ids: List[str] = Field(default_factory=list, description="data_source_files.idの配列")
    parsed_doc_ids: List[str] = Field(default_factory=list, description="パース完了したdocument_ids")
    request_id: str = Field(description="リクエストID")
    topic_id: Optional[str] = Field(default=None, description="トピックID")
    next_status: str = Field(default="not_started", description="次のステータス")
    request_content_id: Optional[str] = Field(default=None, description="request_content ID")
    temp_dir: Optional[str] = Field(default=None, description="一時ディレクトリパス")
    manual_id: Optional[str] = Field(default=None, description="マニュアルID")
    video_path: Optional[str] = Field(default=None, description="動画ファイルパス")
    video_doc_id: Optional[str] = Field(default=None, description="動画ドキュメントID")


class DocumentIndexedEvent(Event):
    document_ids: List[str] = Field(default_factory=list, description="request_documents.idの配列")
    data_source_file_ids: List[str] = Field(default_factory=list, description="data_source_files.idの配列")
    request_id: str = Field(description="リクエストID")
    topic_id: Optional[str] = Field(default=None, description="トピックID")
    next_status: str = Field(default="not_started", description="次のステータス")
    request_content_id: Optional[str] = Field(default=None, description="request_content ID")
    manual_id: Optional[str] = Field(default=None, description="マニュアルID")
    video_path: Optional[str] = Field(default=None, description="動画ファイルパス")
    video_doc_id: Optional[str] = Field(default=None, description="動画ドキュメントID")
    temp_dir: Optional[str] = Field(default=None, description="一時ディレクトリパス")


class ManualGeneratedEvent(Event):
    request_id: str = Field(description="リクエストID")
    topic_id: Optional[str] = Field(default=None, description="トピックID")
    manual_id: Optional[str] = Field(default=None, description="マニュアルID")
    video_path: Optional[str] = Field(default=None, description="動画ファイルパス")
    video_doc_id: Optional[str] = Field(default=None, description="動画ドキュメントID")
    temp_dir: Optional[str] = Field(default=None, description="一時ディレクトリパス")


class PlanGenerationWorkflow(Workflow):

    def __init__(self, db: DatabaseConnection, **kwargs):
        super().__init__(**kwargs)
        self.db = db

    @step
    async def parse_documents(self, ev: StartEvent) -> DocumentParsedEvent:
        document_ids = ev.get("document_ids") or []
        data_source_file_ids = ev.get("data_source_file_ids") or []
        request_id = ev.get("request_id")
        topic_id = ev.get("topic_id")
        next_status = ev.get("next_status", "not_started")

        parse_result = await document_parse_step(
            db=self.db,
            document_ids=document_ids,
            request_id=request_id,
            topic_id=topic_id,
            manual_id=None,
        )

        request_content_id = await asyncio.to_thread(
            get_latest_request_content_id, self.db, request_id
        )

        return DocumentParsedEvent(
            document_ids=document_ids,
            data_source_file_ids=data_source_file_ids,
            parsed_doc_ids=parse_result.get('parsed_doc_ids', []),
            request_id=request_id,
            topic_id=topic_id,
            next_status=next_status,
            request_content_id=request_content_id,
            temp_dir=parse_result.get('temp_dir'),
            manual_id=None,
            video_path=None,
            video_doc_id=None,
        )

    @step
    async def index_documents(self, ev: DocumentParsedEvent) -> DocumentIndexedEvent:
        try:
            if ev.temp_dir:
                await document_index_step(
                    db=self.db,
                    document_ids=ev.document_ids,
                    request_id=ev.request_id,
                    topic_id=ev.topic_id,
                    temp_dir=ev.temp_dir,
                )
        finally:
            if ev.temp_dir:
                shutil.rmtree(ev.temp_dir, ignore_errors=True)

        return DocumentIndexedEvent(
            document_ids=ev.document_ids,
            data_source_file_ids=ev.data_source_file_ids,
            request_id=ev.request_id,
            topic_id=ev.topic_id,
            next_status=ev.next_status,
            request_content_id=ev.request_content_id,
        )

    @step
    async def generate_plan(self, ev: DocumentIndexedEvent) -> StopEvent:
        generated_plan = await generate_plan_step(
            db=self.db,
            document_ids=ev.document_ids,
            request_id=ev.request_id,
            topic_id=ev.topic_id,
            next_status=ev.next_status,
            request_content_id=ev.request_content_id,
            data_source_file_ids=ev.data_source_file_ids,
        )

        return StopEvent(result=generated_plan)


class QaGenerationWorkflow(Workflow):

    def __init__(self, db: DatabaseConnection, **kwargs):
        super().__init__(**kwargs)
        self.db = db

    @step
    async def generate_qa(self, ev: StartEvent) -> StopEvent:
        request_id = ev.get("request_id")
        topic_id = ev.get("topic_id")

        request_content_id = await asyncio.to_thread(
            get_latest_request_content_id, self.db, request_id
        )

        success = await generate_qa_step(
            db=self.db,
            request_id=request_id,
            request_content_id=request_content_id,
        )

        has_conflicts = False
        if success and topic_id:
            try:
                conflicts = await detect_cross_user_conflicts(
                    db=self.db,
                    request_id=request_id,
                    topic_id=topic_id,
                )
                has_conflicts = len(conflicts) > 0
            except Exception as e:
                logger.error(f"Cross-user conflict detection failed: {e}", exc_info=True)

        return StopEvent(result={'success': success, 'has_conflicts': has_conflicts})


async def run_plan_generation(
    db: DatabaseConnection,
    request_id: str,
    topic_id: Optional[str],
    next_status: str,
    document_ids: Optional[List[str]] = None,
    data_source_file_ids: Optional[List[str]] = None,
) -> Optional[str]:
    workflow = PlanGenerationWorkflow(db=db, timeout=600)

    result = await workflow.run(
        request_id=request_id,
        topic_id=topic_id,
        next_status=next_status,
        document_ids=document_ids or [],
        data_source_file_ids=data_source_file_ids or [],
    )

    if result:
        request_content_id = await asyncio.to_thread(
            get_latest_request_content_id, db, request_id
        )
        content_id = await asyncio.to_thread(
            create_or_update_request_content,
            db,
            request_id,
            result,
            request_content_id
        )
        return content_id
    return None


async def run_qa_generation(
    db: DatabaseConnection,
    request_id: str,
    topic_id: Optional[str],
) -> Dict[str, Any]:
    """
    QA生成 + クロスユーザー矛盾検出を実行

    Returns:
        dict: {'success': bool, 'has_conflicts': bool}
    """
    workflow = QaGenerationWorkflow(db=db, timeout=600)

    result = await workflow.run(
        request_id=request_id,
        topic_id=topic_id,
    )

    if result and isinstance(result, dict):
        return result

    return {'success': bool(result), 'has_conflicts': False}


class ManualGenerationWorkflow(Workflow):

    def __init__(self, db: DatabaseConnection, **kwargs):
        super().__init__(**kwargs)
        self.db = db

    @step
    async def parse_documents(self, ev: StartEvent) -> DocumentParsedEvent:
        document_ids = ev.get("document_ids") or []
        data_source_file_ids = ev.get("data_source_file_ids") or []
        request_id = ev.get("request_id")
        topic_id = ev.get("topic_id")

        manual = await asyncio.to_thread(get_manual_by_request_id, self.db, request_id)
        manual_id = manual.get('id') if manual else None

        parse_result = await document_parse_step(
            db=self.db,
            document_ids=document_ids,
            request_id=request_id,
            topic_id=topic_id,
            manual_id=manual_id,
        )

        return DocumentParsedEvent(
            document_ids=document_ids,
            data_source_file_ids=data_source_file_ids,
            parsed_doc_ids=parse_result.get('parsed_doc_ids', []),
            request_id=request_id,
            topic_id=topic_id,
            next_status="completed",
            request_content_id=None,
            temp_dir=parse_result.get('temp_dir'),
            manual_id=manual_id,
            video_path=parse_result.get('video_path'),
            video_doc_id=parse_result.get('video_doc_id'),
        )

    @step
    async def index_documents(self, ev: DocumentParsedEvent) -> DocumentIndexedEvent:
        if ev.temp_dir:
            await document_index_step(
                db=self.db,
                document_ids=ev.document_ids,
                request_id=ev.request_id,
                topic_id=ev.topic_id,
                temp_dir=ev.temp_dir,
            )

        return DocumentIndexedEvent(
            document_ids=ev.document_ids,
            data_source_file_ids=ev.data_source_file_ids,
            request_id=ev.request_id,
            topic_id=ev.topic_id,
            next_status=ev.next_status,
            request_content_id=ev.request_content_id,
            manual_id=ev.manual_id,
            video_path=ev.video_path,
            video_doc_id=ev.video_doc_id,
            temp_dir=ev.temp_dir,
        )

    @step
    async def generate_manual(self, ev: DocumentIndexedEvent) -> ManualGeneratedEvent:
        await generate_manual_step(
            db=self.db,
            request_id=ev.request_id,
            topic_id=ev.topic_id,
            document_ids=ev.document_ids,
            data_source_file_ids=ev.data_source_file_ids,
        )

        return ManualGeneratedEvent(
            request_id=ev.request_id,
            topic_id=ev.topic_id,
            manual_id=ev.manual_id,
            video_path=ev.video_path,
            video_doc_id=ev.video_doc_id,
            temp_dir=ev.temp_dir,
        )

    @step
    async def encode_video(self, ev: ManualGeneratedEvent) -> StopEvent:
        try:
            if ev.video_path and ev.manual_id and ev.video_doc_id:
                await video_encoding_step(
                    db=self.db,
                    video_path=ev.video_path,
                    manual_id=ev.manual_id,
                    video_doc_id=ev.video_doc_id,
                )
            else:
                logger.info("[SKIP] Video encoding (no video to encode)")
        finally:
            if ev.temp_dir:
                shutil.rmtree(ev.temp_dir, ignore_errors=True)

        return StopEvent(result=True)


async def run_manual_generation(
    db: DatabaseConnection,
    request_id: str,
    topic_id: Optional[str],
    document_ids: Optional[List[str]] = None,
    data_source_file_ids: Optional[List[str]] = None,
) -> bool:
    workflow = ManualGenerationWorkflow(db=db, timeout=1800)

    result = await workflow.run(
        request_id=request_id,
        topic_id=topic_id,
        document_ids=document_ids or [],
        data_source_file_ids=data_source_file_ids or [],
    )

    return result if result else False


class ManualVideoUpdateWorkflow(Workflow):

    def __init__(self, db: DatabaseConnection, **kwargs):
        super().__init__(**kwargs)
        self.db = db

    @step
    async def parse_documents(self, ev: StartEvent) -> DocumentParsedEvent:
        document_ids = ev.get("document_ids") or []
        request_id = ev.get("request_id")
        topic_id = ev.get("topic_id")

        manual = await asyncio.to_thread(get_manual_by_request_id, self.db, request_id)
        manual_id = manual.get('id') if manual else None

        parse_result = await document_parse_step(
            db=self.db,
            document_ids=document_ids,
            request_id=request_id,
            topic_id=topic_id,
            manual_id=manual_id,
        )

        return DocumentParsedEvent(
            document_ids=document_ids,
            parsed_doc_ids=parse_result.get('parsed_doc_ids', []),
            request_id=request_id,
            topic_id=topic_id,
            next_status="completed",
            request_content_id=None,
            temp_dir=parse_result.get('temp_dir'),
            manual_id=manual_id,
            video_path=parse_result.get('video_path'),
            video_doc_id=parse_result.get('video_doc_id'),
        )

    @step
    async def generate_manual(self, ev: DocumentParsedEvent) -> ManualGeneratedEvent:
        await generate_manual_step(
            db=self.db,
            request_id=ev.request_id,
            topic_id=ev.topic_id,
            document_ids=ev.parsed_doc_ids,
        )

        return ManualGeneratedEvent(
            request_id=ev.request_id,
            topic_id=ev.topic_id,
            manual_id=ev.manual_id,
            video_path=ev.video_path,
            video_doc_id=ev.video_doc_id,
            temp_dir=ev.temp_dir,
        )

    @step
    async def encode_video(self, ev: ManualGeneratedEvent) -> StopEvent:
        try:
            if ev.video_path and ev.manual_id and ev.video_doc_id:
                await video_encoding_step(
                    db=self.db,
                    video_path=ev.video_path,
                    manual_id=ev.manual_id,
                    video_doc_id=ev.video_doc_id,
                )
            else:
                logger.info("[SKIP] Video encoding (no video to encode)")
        finally:
            if ev.temp_dir:
                shutil.rmtree(ev.temp_dir, ignore_errors=True)

        return StopEvent(result=True)


async def run_manual_video_update(
    db: DatabaseConnection,
    request_id: str,
    topic_id: Optional[str],
    document_ids: Optional[List[str]] = None,
) -> bool:
    workflow = ManualVideoUpdateWorkflow(db=db, timeout=1800)

    result = await workflow.run(
        request_id=request_id,
        topic_id=topic_id,
        document_ids=document_ids or [],
    )

    return result if result else False
