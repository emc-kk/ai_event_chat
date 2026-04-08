import os
import yaml
from typing import Dict, Any


def load_prompts() -> Dict[str, Any]:
    prompts_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        'prompts.yml'
    )
    with open(prompts_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)

