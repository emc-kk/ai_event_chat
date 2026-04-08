import os
import tempfile
import shutil
import logging
from typing import List, Dict, Any
from llama_index.readers.file import PyMuPDFReader
from llama_index.core import SimpleDirectoryReader
from llama_index.core.llms import ChatMessage, TextBlock, ImageBlock
from pdf2image import convert_from_path

logger = logging.getLogger(__name__)

from .prompt_loader import load_prompts
from .llm import get_vision_llm

PDF_FILE_EXTRACTOR = {".pdf": PyMuPDFReader()}

IMAGE_TYPES = {'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif', 'ico', 'svg'}
VIDEO_TYPES = {'mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'm4v', 'mpeg', 'mpg', '3gp'}
AUDIO_TYPES = {'mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus'}
DOCUMENT_TYPES = {'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf'}
TEXT_TYPES = {'txt', 'md', 'csv', 'json', 'xml', 'yaml', 'yml', 'html', 'htm', 'log'}
ARCHIVE_TYPES = {'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'}


def get_file_extension(filename: str) -> str:
    if '.' not in filename:
        return ''
    return filename.rsplit('.', 1)[-1].lower()


def classify_file_type(file_type: str = None, filename: str = None) -> str:
    ext = file_type.lower() if file_type else None
    if not ext and filename:
        ext = get_file_extension(filename)
    if not ext:
        return 'unknown'

    if ext in IMAGE_TYPES:
        return 'image'
    elif ext in VIDEO_TYPES:
        return 'video'
    elif ext in AUDIO_TYPES:
        return 'audio'
    elif ext in DOCUMENT_TYPES:
        return 'document'
    elif ext in TEXT_TYPES:
        return 'text'
    elif ext in ARCHIVE_TYPES:
        return 'archive'
    else:
        return 'unknown'


def is_image_file(file_type: str = None, filename: str = None) -> bool:
    return classify_file_type(file_type, filename) == 'image'


def is_video_file(file_type: str = None, filename: str = None) -> bool:
    return classify_file_type(file_type, filename) == 'video'


def is_audio_file(file_type: str = None, filename: str = None) -> bool:
    return classify_file_type(file_type, filename) == 'audio'


def is_document_file(file_type: str = None, filename: str = None) -> bool:
    return classify_file_type(file_type, filename) == 'document'


def is_text_file(file_type: str = None, filename: str = None) -> bool:
    return classify_file_type(file_type, filename) == 'text'


def is_processable_file(file_type: str = None, filename: str = None) -> bool:
    classified = classify_file_type(file_type, filename)
    return classified in {'image', 'document', 'text'}


def clean_text(text):
    if text is None:
        return ""
    text = text.replace('\x00', '')
    text = ''.join(char for char in text if char.isprintable() or char in '\n\r\t ')
    return text


PROMPTS = load_prompts()


def call_vision_api(image_path: str, prompt: str) -> str:
    try:
        llm = get_vision_llm()

        messages = [
            ChatMessage(
                role="user",
                blocks=[
                    ImageBlock(path=image_path),
                    TextBlock(text=prompt),
                ]
            )
        ]

        response = llm.chat(messages)
        return str(response.message.content) if response.message.content else ""

    except Exception as e:
        logger.warning(f"Error calling Vision API: {str(e)}", exc_info=True)
        return ""


def process_pdf_with_vision(file_path: str) -> List[str]:
    temp_dir = None
    try:
        images = convert_from_path(file_path)
        page_texts = []
        prompt = PROMPTS['vision']['pdf_page']

        temp_dir = tempfile.mkdtemp()

        for page_num, image in enumerate(images, start=1):
            temp_image_path = os.path.join(temp_dir, f"page_{page_num}.png")
            image.save(temp_image_path, format='PNG')

            extracted_text = call_vision_api(
                image_path=temp_image_path,
                prompt=prompt,
            )

            if extracted_text:
                page_texts.append(f"--- ページ {page_num} ---\n{extracted_text}")

        return page_texts

    except Exception as e:
        logger.warning(f"Error processing PDF with Vision: {str(e)}", exc_info=True)
        return [f"[PDF Vision処理エラー: {os.path.basename(file_path)}]"]

    finally:
        if temp_dir:
            shutil.rmtree(temp_dir, ignore_errors=True)


def process_image_file(filename: str, content: bytes) -> str:
    temp_dir = None
    try:
        prompt = PROMPTS['vision']['image']

        temp_dir = tempfile.mkdtemp()
        temp_image_path = os.path.join(temp_dir, filename)
        with open(temp_image_path, 'wb') as f:
            f.write(content)

        result = call_vision_api(
            image_path=temp_image_path,
            prompt=prompt,
        )

        if result:
            return f"[画像ファイル: {filename}]\n{result}"
        else:
            return f"[画像ファイル処理エラー: {filename}]"

    except Exception as e:
        logger.warning(f"Error processing image: {str(e)}", exc_info=True)
        return f"[画像ファイル処理エラー: {filename}]"

    finally:
        if temp_dir:
            shutil.rmtree(temp_dir, ignore_errors=True)


EXCLUDED_PATTERNS = [f"*.{ext}" for ext in (VIDEO_TYPES | AUDIO_TYPES)]


def load_and_clean_documents(path: str, is_directory: bool = False):
    if is_directory:
        reader = SimpleDirectoryReader(
            input_dir=path,
            file_extractor=PDF_FILE_EXTRACTOR,
            exclude=EXCLUDED_PATTERNS,
        )
    else:
        reader = SimpleDirectoryReader(
            input_files=[path],
            file_extractor=PDF_FILE_EXTRACTOR
        )

    documents = reader.load_data()

    for doc in documents:
        if hasattr(doc, 'text') and doc.text:
            doc.set_content(clean_text(doc.text))

    return documents


def process_document_file(file_path: str, file_type: str = None) -> List[str]:
    try:
        filename = os.path.basename(file_path)
        classified = classify_file_type(file_type, filename)

        if classified == 'image':
            with open(file_path, 'rb') as f:
                content = f.read()
            text = process_image_file(filename, content)
            return [text] if text else []

        documents = load_and_clean_documents(file_path, is_directory=False)

        texts = []
        for doc in documents:
            text_content = None
            if hasattr(doc, 'text') and doc.text:
                text_content = doc.text
            elif hasattr(doc, 'get_content'):
                text_content = doc.get_content()

            if text_content and text_content.strip():
                texts.append(text_content)

        ext = file_type.lower() if file_type else get_file_extension(filename)
        if len(texts) == 0 and ext == 'pdf':
            texts = process_pdf_with_vision(file_path)

        return texts

    except Exception as e:
        logger.warning(f"Error processing document: {str(e)}", exc_info=True)
        return [f"[ドキュメント処理エラー: {os.path.basename(file_path)}]"]


def process_files(files: List[Dict[str, Any]]) -> str:
    if not files:
        return ""

    temp_base_dir = tempfile.mkdtemp()
    try:
        file_texts = []

        for idx, file_data in enumerate(files):
            filename = file_data['filename']
            content = file_data['content']
            file_type = file_data.get('file_type')

            if is_image_file(file_type, filename):
                text = process_image_file(filename, content)
                file_texts.append(text)
            else:
                file_temp_dir = os.path.join(temp_base_dir, str(idx))
                os.makedirs(file_temp_dir, exist_ok=True)
                file_path = os.path.join(file_temp_dir, filename)

                with open(file_path, 'wb') as f:
                    f.write(content)

                texts = process_document_file(file_path, file_type)
                file_texts.extend(texts)

        if file_texts:
            return "\n\n".join(file_texts)
        return ""

    finally:
        shutil.rmtree(temp_base_dir, ignore_errors=True)
