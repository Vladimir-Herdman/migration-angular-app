import asyncio
import json
import os
import re
import yaml
from typing import Any, Dict, List, Optional, Tuple

import ollama
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import ValidationError
from datetime import datetime, timedelta
from models import ProcessedRelocationTask, QuizFormData, ServiceRecommendation

load_dotenv()

# --- Configuration ---
LLM_MODEL_NAME = os.getenv("LLM_MODEL_NAME", "qwen3:1.7b")
BACKEND_PORT = int(os.getenv("BACKEND_PORT", 8000))
FRONTEND_ORIGINS = os.getenv("FRONTEND_ORIGINS", "http://localhost:8100").split(',')

# Construct absolute paths from the script's location
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHECKLISTS_DIR = os.path.join(BASE_DIR, 'Checklists')

SERVICES_DATA_PATH = os.path.join(CHECKLISTS_DIR, 'services.yaml')
PREDEPART_DATA_PATH = os.path.join(CHECKLISTS_DIR, 'predepart.yaml')
DEPART_DATA_PATH = os.path.join(CHECKLISTS_DIR, 'depart.yaml')
ARRIVE_DATA_PATH = os.path.join(CHECKLISTS_DIR, 'arrive.yaml')

# --- FastAPI App Setup ---
app = FastAPI(title="Smooth Migration LLM Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Global Data Stores ---
services_data_list: List[Dict[str, Any]] = []
all_task_templates: List[Dict[str, Any]] = []

# --- Data Loading Functions ---
def load_yaml_file(file_path: str, data_type_name: str) -> List[Dict[str, Any]]:
    """Loads and validates data from a YAML file, expecting a list of dictionaries."""
    if not os.path.exists(file_path):
        print(f"ERROR: {data_type_name} file not found at {file_path}")
        return []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        if not isinstance(data, list):
            print(f"WARNING: Root of {os.path.basename(file_path)} is not a list. Expected list of {data_type_name}.")
            return []
        
        valid_items = []
        for i, item in enumerate(data):
            if not isinstance(item, dict):
                print(f"WARNING: Item at index {i} in {os.path.basename(file_path)} is not a dictionary. Skipping.")
                continue
            valid_items.append(item)
        
        print(f"Successfully loaded {len(valid_items)} {data_type_name} from {os.path.basename(file_path)}")
        return valid_items
    except yaml.YAMLError as e:
        print(f"ERROR decoding YAML from {file_path}: {e}")
    except Exception as e:
        print(f"ERROR loading data from {file_path}: {e}")
    return []

def initialize_global_data():
    """Loads all necessary YAML data into global variables."""
    global services_data_list, all_task_templates
    print("Initializing global data...")

    services_data_list = load_yaml_file(SERVICES_DATA_PATH, "services")
    
    predepart_tasks = load_yaml_file(PREDEPART_DATA_PATH, "predeparture tasks")
    depart_tasks = load_yaml_file(DEPART_DATA_PATH, "departure tasks")
    arrive_tasks = load_yaml_file(ARRIVE_DATA_PATH, "arrival tasks")
    
    # Assign 'stage' if not present in task template (though it should be)
    for task in predepart_tasks: task.setdefault('stage', 'predeparture')
    for task in depart_tasks: task.setdefault('stage', 'departure')
    for task in arrive_tasks: task.setdefault('stage', 'arrival')
        
    all_task_templates = predepart_tasks + depart_tasks + arrive_tasks
    print(f"Total task templates loaded: {len(all_task_templates)}")
    if not all_task_templates:
        print("WARNING: No task templates loaded. Checklist generation will likely fail or be empty.")
    if not services_data_list:
        print("WARNING: No services data loaded. Service recommendations will be empty.")

# Call data loading on startup
initialize_global_data()


# --- Helper Functions for Task Processing ---
def get_nested_value(data_dict: Dict[str, Any], path_str: str, default: Any = None) -> Any:
    """Safely retrieves a nested value from a dictionary using a dot-separated path."""
    keys = path_str.split('.')
    value = data_dict
    for key in keys:
        if isinstance(value, dict):
            value = value.get(key)
            if value is None: return default
        # Basic list index access, e.g., 'some_list.0'
        elif isinstance(value, list) and key.isdigit():
            try:
                index = int(key)
                if 0 <= index < len(value):
                    value = value[index]
                else: return default # Index out of bounds
            except (ValueError, IndexError):
                return default
        else:
            return default
    return value

def evaluate_condition(quiz_value: Any, condition_details: Dict[str, Any]) -> bool:
    """Evaluates a single condition from 'applies_if'."""
    if "equals" in condition_details:
        return quiz_value == condition_details["equals"]
    if "not_equals" in condition_details:
        return quiz_value != condition_details["not_equals"]
    if "in" in condition_details:
        expected_list = condition_details["in"]
        return isinstance(expected_list, list) and quiz_value in expected_list
    if "not_in" in condition_details:
        expected_list = condition_details["not_in"]
        return isinstance(expected_list, list) and quiz_value not in expected_list
    if "is_true" in condition_details: # Handles quiz_value being True
        return quiz_value is True
    if "is_false" in condition_details: # Handles quiz_value being False
        return quiz_value is False
    # Could add more operators: 'greater_than', 'contains' (for strings/lists)
    print(f"WARNING: Unknown operator in condition: {condition_details}")
    return False # Fail safe for unknown operator

def check_task_applicability(task_template: Dict[str, Any], quiz_data_dict: Dict[str, Any]) -> bool:
    """Determines if a task template applies based on quiz data and 'applies_if' conditions."""
    conditions = task_template.get("applies_if")
    if not conditions:
        return True
    if not isinstance(conditions, list):
        print(f"WARNING: 'applies_if' for task '{task_template.get('task_id')}' is not a list. Task will not apply.")
        return False

    for condition_set in conditions: # Each item in applies_if is a condition object
        if not isinstance(condition_set, dict) or "path" not in condition_set:
            print(f"WARNING: Malformed condition in 'applies_if' for task '{task_template.get('task_id')}': {condition_set}")
            return False

        quiz_value = get_nested_value(quiz_data_dict, condition_set["path"])
        
        # If path doesn't resolve to a value, it can only satisfy 'is_false' if that implies non-existence,
        # or 'equals: None' if explicitly checking for None.
        # Current evaluate_condition handles quiz_value being None correctly for 'equals' and 'is_false'.

        if not evaluate_condition(quiz_value, condition_set):
            return False # This task does not apply if any condition set is not met
            
    return True # All condition sets were met

async def personalize_explanation_with_llm(base_explanation: str, task_desc: str, quiz_data: QuizFormData) -> str:
    """Uses LLM to personalize a base explanation. Fallback to base_explanation with simple replacement."""
    explanation = base_explanation.replace("[Destination Country]", quiz_data.destination or "your destination")
    explanation = explanation.replace("[Destination City/Region]", quiz_data.destination or "your new city/Region")


    if not task_desc: # Safety check
        return explanation

    quiz_summary_parts = [
        f"Moving type: {quiz_data.moveType}",
        f"Destination: {quiz_data.destination}",
        f"Move date: {quiz_data.moveDate}",
    ]
    if quiz_data.family.get("children"): quiz_summary_parts.append("Moving with children")
    if quiz_data.family.get("pets"): quiz_summary_parts.append("Moving with pets")
    quiz_summary_parts.append(f"Vehicle plan: {quiz_data.vehicle}")
    quiz_summary_parts.append(f"Current housing: {quiz_data.currentHousing or 'not specified'}")
    quiz_summary_parts.append(f"New housing: {quiz_data.newHousing or 'not arranged' if quiz_data.hasHousing else 'not arranged'}")
    quiz_summary_parts.append(f"Job at destination: {'Yes' if quiz_data.hasJob else 'No'}")
    
    user_context = ". ".join(quiz_summary_parts) + "."

    prompt = f"""
    Context: The user is planning a relocation.
    User's Situation: {user_context}
    Task: "{task_desc}"
    Base explanation for this task's importance: "{explanation}"

    Your goal: Briefly (up to 6 sentences) refine or add to the base explanation to make it *more directly relevant* to this specific user's situation, highlighting why this task is important *for them*.
    If the base explanation is already highly relevant and general enough, return it with minimal additions.
    Focus on the "why" for this user.
    
    Output ONLY the personalized explanation text. Do not include preambles like "Here's the personalized explanation:".
    Be concise.
    """
    try:
        # print(f"DEBUG: Sending to LLM for task '{task_desc}'. Prompt (simplified): {prompt[:200]}...")
        response = await asyncio.to_thread(
            ollama.chat,
            model=LLM_MODEL_NAME,
            messages=[{'role': 'user', 'content': prompt}],
            options={'temperature': 0.6}
        )
        raw_personalized_text = response['message']['content'].strip()
        
        # --- AGGRESSIVE STRIPPING FOR <think> and PREAMBLES ---
        # Stage 1: Remove <think>...</think> blocks, being very greedy about content and flexible with tags
        # This regex tries to find <think> (case-insensitive) and then everything up to </think> (case-insensitive)
        # It also handles potential attributes within the <think ...> tag if any were to appear.
        text_after_think_strip = re.sub(r"<think[^>]*>.*?</think>\s*", "", raw_personalized_text, flags=re.DOTALL | re.IGNORECASE)
        
        # Stage 2: If the above didn't catch it, try a simpler one just in case the content was minimal
        if "<think>" in text_after_think_strip.lower(): # Check if it's still there
             text_after_think_strip = re.sub(r"<think>.*?</think>", "", text_after_think_strip, flags=re.DOTALL | re.IGNORECASE)


        # Stage 3: Clean common LLM preambles from the result of the think_strip
        final_personalized_text = text_after_think_strip.strip() # Start with a clean strip
        
        # Remove conversational starters that might appear before the actual content
        # (even after <think> block removal if the think block was the very first thing)
        common_starters_to_strip = [
            "Okay, let's see.",
            "Alright, "
            # Add any other observed conversational starters
        ]
        for starter in common_starters_to_strip:
            if final_personalized_text.lower().startswith(starter.lower()):
                final_personalized_text = final_personalized_text[len(starter):].strip()
                break # Only strip one starter

        # Now remove more formal preambles
        prefixes_to_remove = [
            "personalized explanation:", "here is the personalized explanation:", 
            "certainly, here's the refined explanation:", "okay, here's a personalized take:",
            "the personalized explanation is:", "explanation:",
            # If the LLM sometimes outputs "Okay, let's see." OUTSIDE the think block,
            # but before the actual explanation, the common_starters_to_strip should handle it.
        ]
        normalized_text_for_prefix_check = final_personalized_text.lower().strip() # Re-normalize and strip before check
        for prefix in prefixes_to_remove:
            if normalized_text_for_prefix_check.startswith(prefix.lower()):
                final_personalized_text = final_personalized_text[len(prefix):].strip()
                break 
        
        # Stage 4: Final cleanup of leading/trailing newlines or excessive whitespace
        final_personalized_text = final_personalized_text.lstrip('\n').strip()
        # Replace multiple newlines or spaces with a single space if needed (optional, can affect formatting)
        # final_personalized_text = re.sub(r'\s{2,}', ' ', final_personalized_text) 
        # --- END OF AGGRESSIVE STRIPPING ---

        # print(f"DEBUG: LLM raw explanation for '{task_desc}': {raw_personalized_text}")
        #print(f"DEBUG: LLM text after <think> strip for '{task_desc}': {text_after_think_strip}")
        #print(f"DEBUG: LLM final personalized explanation for '{task_desc}': {final_personalized_text}")
        return final_personalized_text if final_personalized_text else explanation
    except Exception as e:
        print(f"ERROR personalizing explanation with LLM for task '{task_desc}': {e}. Falling back.")
        return explanation

def find_matching_services(task_template: Dict[str, Any]) -> List[ServiceRecommendation]:
    """Finds matching services based on direct IDs or keywords from task_template."""
    output_services: List[ServiceRecommendation] = []
    # `seen_service_ids` should store the 'id' value from the YAML to prevent re-processing the same YAML entry
    processed_yaml_ids = set()

    # 1. Prioritize direct service IDs from YAML
    direct_service_ids_from_task = task_template.get("recommended_service_ids", [])
    if isinstance(direct_service_ids_from_task, list):
        for service_yaml_id in direct_service_ids_from_task: # This is the string ID like "realtor_locator"
            if len(output_services) >= 2:
                break
            
            service_def = next((s for s in services_data_list if s.get("id") == service_yaml_id), None)
            
            if service_def and service_yaml_id not in processed_yaml_ids:
                try:
                    transformed_def = service_def.copy()
                    if 'id' in transformed_def:
                        transformed_def['service_id'] = transformed_def.pop('id')
                    else:
                        print(f"WARNING: Service definition for '{service_yaml_id}' missing 'id' field. Skipping.")
                        processed_yaml_ids.add(service_yaml_id) # Mark as processed even if skipped
                        continue
                    
                    service_model = ServiceRecommendation(**transformed_def)
                    output_services.append(service_model)
                    processed_yaml_ids.add(service_yaml_id) # Add the original YAML id to set
                except ValidationError as e:
                    print(f"ERROR: Service validation failed for directly recommended ID '{service_yaml_id}': {e}")
                    processed_yaml_ids.add(service_yaml_id) # Mark as processed even on error
    
    if len(output_services) >= 2:
        return output_services

    # 2. If fewer than 2 services found, try matching with specific keywords
    task_service_keywords = [k.lower() for k in task_template.get("highly_specific_keywords_for_services", []) if isinstance(k, str)]
    
    # Only proceed with keyword matching if we still need services AND there are keywords to match
    if len(output_services) < 2 and task_service_keywords:
        CATEGORY_MATCH_SCORE = 3
        KEYWORD_MATCH_SCORE = 1
        MIN_SCORE_THRESHOLD = 1

        scored_candidates_data: List[Tuple[Dict[str, Any], int]] = [] # Store (service_def, score)

        for service_def in services_data_list:
            service_yaml_id = service_def.get("id")
            if not service_yaml_id or service_yaml_id in processed_yaml_ids: # Skip if no ID or already processed
                continue

            current_score = 0
            service_categories = [cat.lower() for cat in service_def.get("relevant_categories", []) if isinstance(cat,str)]
            service_own_keywords = [kw.lower() for kw in service_def.get("keywords", []) if isinstance(kw,str)]

            for task_kw in task_service_keywords:
                if task_kw in service_categories:
                    current_score += CATEGORY_MATCH_SCORE
                if task_kw in service_own_keywords: 
                    current_score += KEYWORD_MATCH_SCORE
            
            if current_score >= MIN_SCORE_THRESHOLD:
                scored_candidates_data.append((service_def, current_score))

        # Sort candidates by score (desc)
        scored_candidates_data.sort(key=lambda item: item[1], reverse=True)

        for service_def_candidate, score in scored_candidates_data:
            if len(output_services) >= 2:
                break
            
            service_yaml_id_candidate = service_def_candidate.get("id") # Should exist if it got here
            if service_yaml_id_candidate in processed_yaml_ids: # Double check, though outer loop should prevent
                continue

            try:
                transformed_def_candidate = service_def_candidate.copy()
                if 'id' in transformed_def_candidate:
                    transformed_def_candidate['service_id'] = transformed_def_candidate.pop('id')
                else:
                    # This case should ideally not be reached if service_yaml_id_candidate was valid
                    print(f"WARNING: Keyword-matched service definition for '{service_yaml_id_candidate}' missing 'id' unexpectedly. Skipping.")
                    processed_yaml_ids.add(service_yaml_id_candidate)
                    continue
                
                service_model = ServiceRecommendation(**transformed_def_candidate)
                output_services.append(service_model)
                processed_yaml_ids.add(service_yaml_id_candidate) # Add original YAML id
            except ValidationError as e:
                print(f"ERROR: Service validation failed for keyword-matched service YAML ID '{service_yaml_id_candidate}': {e}")
                processed_yaml_ids.add(service_yaml_id_candidate)
            
    return output_services

# In backend/main.py

def calculate_absolute_due_date(yaml_due_date_str: str, move_date_iso: str) -> str:
     return yaml_due_date_str.strip() if yaml_due_date_str else ""


async def process_single_task_template(task_template: Dict[str, Any], quiz_data: QuizFormData) -> Optional[ProcessedRelocationTask]:
    """Processes a single task template to generate a ProcessedRelocationTask."""
    task_id = task_template.get("task_id", f"unknown_task_{os.urandom(4).hex()}")
    task_desc = task_template.get("task_description", "Task description not provided.")
    
    # Get base explanation
    final_explanation = task_template.get("base_importance_explanation", "This task is important for your relocation.")
    final_explanation = final_explanation.replace("[Destination Country]", quiz_data.destination or "your destination")
    final_explanation = final_explanation.replace("[Destination City/Region]", quiz_data.destination or "your new city/region")
    
    # Personalize if flagged in YAML
    if task_template.get("personalize_explanation", False):
        final_explanation = await personalize_explanation_with_llm(final_explanation, task_desc, quiz_data)

    # Get recommended services
    recommended_services = find_matching_services(task_template)


    original_yaml_due_date = task_template.get("due_date", "As soon as possible")
    calculated_due_date_iso = calculate_absolute_due_date(original_yaml_due_date, quiz_data.moveDate) # Pass quiz_data.moveDate

    try:
        return ProcessedRelocationTask(
            task_id=task_id,
            task_description=task_desc,
            priority=task_template.get("priority", "Low"),
            due_date=calculated_due_date_iso,
            importance_explanation=final_explanation,
            recommended_services=recommended_services,
            stage=task_template.get("stage", "unknown"), # Should be set during loading
            category=task_template.get("category", "General")
        )
    except ValidationError as e:
        print(f"ERROR validating ProcessedRelocationTask for '{task_desc}' (ID: {task_id}): {e}")
        return None

# --- API Endpoints ---
@app.post("/generate_tasks", response_model=None) # response_model=None for StreamingResponse
async def stream_relocation_tasks(quiz_data: QuizFormData):
    print(f"Received /generate_tasks request. Quiz data: {quiz_data.model_dump(exclude_none=True)}")
    if not all_task_templates:
        print("CRITICAL ERROR: No task templates available. Check YAML loading.")
        raise HTTPException(status_code=500, detail="Task templates not loaded on server.")

    quiz_data_dict = quiz_data.model_dump()
    
    applicable_task_templates: List[Dict[str, Any]] = []
    for tt in all_task_templates:
        if check_task_applicability(tt, quiz_data_dict):
            applicable_task_templates.append(tt)
    
    print(f"Filtered to {len(applicable_task_templates)} applicable task templates.")

    # Prepare initial structure (categories and counts)
    stage_task_counts: Dict[str, int] = {"predeparture": 0, "departure": 0, "arrival": 0}
    # categories_by_stage will map stage to a list of unique category names in that stage
    categories_by_stage: Dict[str, List[str]] = {"predeparture": [], "departure": [], "arrival": []}
    
    _temp_cats_by_stage: Dict[str, set[str]] = {"predeparture": set(), "departure": set(), "arrival": set()}
    for tt in applicable_task_templates:
        stage = tt.get("stage", "unknown")
        category = tt.get("category", "General")
        if stage in stage_task_counts:
            stage_task_counts[stage] += 1
            _temp_cats_by_stage[stage].add(category)
    
    for stage_key in categories_by_stage:
        categories_by_stage[stage_key] = sorted(list(_temp_cats_by_stage[stage_key]))

    initial_stream_message = {
        "event_type": "initial_structure", # Add event type for frontend to distinguish
        "total_applicable_tasks": len(applicable_task_templates),
        "stage_totals": stage_task_counts,
        "categories_by_stage": categories_by_stage
    }
    
    # Sort applicable_task_templates for consistent streaming order
    # Example: by stage, then by priority (High > Medium > Low), then by due_date (needs parsing)
    stage_order_map = {"predeparture": 0, "departure": 1, "arrival": 2, "unknown": 99}
    priority_order_map = {"High": 0, "Medium": 1, "Low": 2, "Unknown": 99}
    
    applicable_task_templates.sort(key=lambda t: (
        stage_order_map.get(t.get("stage", "unknown"), 99),
        priority_order_map.get(t.get("priority", "Low"), 99)
        # maybe we should add due_date sorting if due_date format is consistent and parsable
    ))

    async def task_stream_generator():
        yield json.dumps(initial_stream_message) + "\n"
        print(f"Streamed initial structure: {initial_stream_message}")

        processed_task_count = 0
        for task_template in applicable_task_templates:
            processed_task = await process_single_task_template(task_template, quiz_data)
            if processed_task:
                task_to_send = processed_task.model_dump()
                task_to_send["event_type"] = "task_item" # Add event type
                # These are UI specific, added before sending if not in ProcessedRelocationTask model
                task_to_send.setdefault("isExpanded", False) 
                task_to_send.setdefault("completed", False)
                yield json.dumps(task_to_send) + "\n"
                processed_task_count += 1
            await asyncio.sleep(0.01) # Small delay to allow other I/O, can be tuned
        
        print(f"Finished streaming {processed_task_count} tasks.")
        # Optionally, send a "stream_end" event
        yield json.dumps({"event_type": "stream_end", "total_streamed": processed_task_count}) + "\n"

    return StreamingResponse(task_stream_generator(), media_type="application/x-ndjson")

@app.post("/chat")
async def chat_with_llm(payload: Dict[str, Any]):
    message = payload.get("message")
    history = payload.get("history", []) # Expecting list of {'role': '...', 'content': '...'}
    if not message:
        raise HTTPException(status_code=400, detail="Message not provided")

    print(f"Received chat: '{message}'. History length: {len(history)}.")
    
    messages_for_llm = history + [{'role': 'user', 'content': message}]
    
    try:
        response = await asyncio.to_thread(
            ollama.chat,
            model=LLM_MODEL_NAME,
            messages=messages_for_llm,
            options={'temperature': 0.7} # Adjust as needed
        )
        response_text = re.sub(r'<think>(?s:.)*?</think>\n\n', '', response['message']['content'])
        # response_text = response['message']['content']
        print(f"LLM chat response: {response_text[:100]}...")
        return {"response": response_text}
    except Exception as e:
        print(f"ERROR during Ollama chat call: {e}")
        # Consider more specific error handling if Ollama provides error codes/types
        raise HTTPException(status_code=503, detail="Chat service unavailable or encountered an error.")

@app.get("/", include_in_schema=False) # Basic health check
async def root_health_check():
  return {"message": f"Smooth Migration LLM Backend ({LLM_MODEL_NAME}) is healthy and running!"}

# --- Main Execution (for direct run) ---
if __name__ == "__main__":
    import uvicorn
    print(f"Starting Uvicorn server on port {BACKEND_PORT} for {LLM_MODEL_NAME}...")
    # Use reload=True for development only
    uvicorn.run("main:app", host="0.0.0.0", port=BACKEND_PORT, reload=True)
