from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import ValidationError
from dotenv import load_dotenv
import ollama
import json
import os
import asyncio
from typing import List, Dict, Any, Optional

from models import QuizFormData, TaskListOutput, RelocationTask, ServiceRecommendation

load_dotenv()

# --- Configuration ---
LLM_MODEL_NAME = os.getenv("LLM_MODEL_NAME", "llama3.1:8b-instruct-q5_K_M")
BACKEND_PORT = int(os.getenv("BACKEND_PORT", 8000))
FRONTEND_ORIGINS = os.getenv("FRONTEND_ORIGINS", "http://localhost:8100").split(',')
SERVICES_DATA_PATH = os.path.join(os.path.dirname(__file__), '../Checklists/services.json')

PREDEPART_DATA_PATH = os.path.join(os.path.dirname(__file__), '../Checklists/predepart.json')
DEPART_DATA_PATH = os.path.join(os.path.dirname(__file__), '../Checklists/depart.json')
ARRIVE_DATA_PATH = os.path.join(os.path.dirname(__file__), '../Checklists/arrive.json')

# --- FastAPI App Setup ---
app = FastAPI()

# Configure CORS middleware
app.add_middleware(
  CORSMiddleware,
  allow_origins=FRONTEND_ORIGINS,
  allow_credentials=True,
  allow_methods=["*"], # Allows all methods (POST, GET, etc.)
  allow_headers=["*"], # Allows all headers
)

services_data: List[Dict[str, Any]] = []

def load_services_data():
    try:
        with open(SERVICES_DATA_PATH, 'r') as f:
            global services_data
            services_data = json.load(f)
        print(f"Successfully loaded {len(services_data)} services from {SERVICES_DATA_PATH}")
    except FileNotFoundError:
        print(f"Error: Services data file not found at {SERVICES_DATA_PATH}")
    except json.JSONDecodeError as e:
        print(f"Error decoding services data JSON from {SERVICES_DATA_PATH}: {e}")
        print("Please ensure your services.json file is valid JSON with no comments.")
    except Exception as e:
        print(f"Error loading services data: {e}")

load_services_data()

all_base_tasks: List[Dict[str, Any]] = []

def load_base_checklist_data():
    global all_base_tasks
    all_base_tasks = []

    base_files = {
        "predeparture": PREDEPART_DATA_PATH,
        "departure": DEPART_DATA_PATH,
        "arrival": ARRIVE_DATA_PATH
    }

    for stage, file_path in base_files.items():
        try:
            with open(file_path, 'r') as f:
                structured_data = json.load(f)

                if not isinstance(structured_data, dict):
                    print(f"Warning: Top level of {os.path.basename(file_path)} is not a dictionary. Skipping loading.")
                    continue

                for move_type, move_data in structured_data.items():
                    if not isinstance(move_data, dict):
                         print(f"Warning: Data for move type '{move_type}' in {os.path.basename(file_path)} is not a dictionary. Skipping.")
                         continue

                    for category, category_data in move_data.items():
                         if isinstance(category_data, list):
                             for task_item in category_data:
                                 if isinstance(task_item, dict):
                                     task = task_item.copy()
                                     task['stage'] = stage
                                     task['move_type'] = move_type.lower()
                                     task['category'] = category.lower()
                                     task['description'] = task.get('task_description', 'No description provided in JSON')
                                     task['priority'] = task.get('priority', 'Low')
                                     task['due_date_hint'] = task.get('due_date', 'No due date hint in JSON')
                                     task['importance_explanation'] = task.get('importance_explanation', 'Explanation not provided in JSON')
                                     task['service_keywords'] = task.get('service_keywords', [])
                                     all_base_tasks.append(task)
                         elif isinstance(category_data, dict):
                             for sub_category, tasks_list in category_data.items():
                                  if isinstance(tasks_list, list):
                                      for task_item in tasks_list:
                                          if isinstance(task_item, dict):
                                              task = task_item.copy()
                                              task['stage'] = stage
                                              task['move_type'] = move_type.lower()
                                              task['category'] = category.lower()
                                              task['sub_category'] = sub_category.lower()
                                              task['description'] = task.get('task_description', 'No description provided in JSON')
                                              task['priority'] = task.get('priority', 'Low')
                                              task['due_date_hint'] = task.get('due_date', 'No due date hint in JSON')
                                              task['importance_explanation'] = task.get('importance_explanation', 'Explanation not provided in JSON')
                                              task['service_keywords'] = task.get('service_keywords', [])
                                              all_base_tasks.append(task)

            print(f"Successfully loaded tasks from {os.path.basename(file_path)}")

        except FileNotFoundError:
            print(f"Error: Base checklist file not found at {file_path}")
        except json.JSONDecodeError as e:
            print(f"Error decoding base checklist JSON from {file_path}: {e}")
            print("Please ensure your checklist JSON files are valid JSON with no comments.")
        except Exception as e:
            print(f"Error loading base checklist data from {file_path}: {e}")
            if "'str' object does not support item assignment" in str(e):
                 print(f"Hint: This error often means the JSON file {os.path.basename(file_path)} contains simple lists of strings where structured task objects (dictionaries) are expected.")

load_base_checklist_data()

def check_task_applies(task: Dict[str, Any], quiz_data: QuizFormData) -> bool:
    task_move_type = task.get('move_type')
    task_category = task.get('category')
    task_sub_category = task.get('sub_category')

    if task_move_type and task_move_type != quiz_data.moveType.lower():
        return False

    if task_category:
        if task_category == 'children' and not quiz_data.family.get('children'):
            return False
        if task_category == 'pets' and not quiz_data.family.get('pets'):
            return False
        if task_category == 'realtor' and not (quiz_data.currentHousing == 'own' or (quiz_data.hasHousing and quiz_data.newHousing == 'own')):
             return False
        if task_category == 'landlord' and not quiz_data.currentHousing == 'rent':
             return False

    if task_sub_category:
        if task_category == 'vehicle':
            if task_sub_category == 'renting' and quiz_data.vehicle != 'rent':
                 return False
            if task_sub_category == 'bringing' and quiz_data.vehicle != 'bring':
                 return False

    return True

async def process_single_task_with_llm(task: Dict[str, Any], quiz_data: QuizFormData, service_data: List[Dict[str, Any]]) -> Optional[RelocationTask]:
    task_description = task.get("description", "Unknown Task")
    original_priority = task.get("priority", "Low")
    original_due_date = task.get("due_date_hint", "No due date hint")
    stage = task.get("stage", "unknown")

    move_type = quiz_data.moveType
    destination = quiz_data.destination
    move_date = quiz_data.moveDate
    moving_with = []
    if quiz_data.family.get("children"): moving_with.append("children")
    if quiz_data.family.get("pets"): moving_with.append("pets")
    moving_with_str = "with " + " and ".join(moving_with) if moving_with else "alone"
    vehicle_plan = quiz_data.vehicle
    current_housing = quiz_data.currentHousing
    new_housing = quiz_data.newHousing if quiz_data.hasHousing else "not yet arranged"
    has_job = quiz_data.hasJob

    service_keywords_list = [
        "Transportation", "Packing", "Departure Logistics", "Immigration_Documents",
        "Predeparture Planning", "Housing", "Arrival Logistics", "Utilities",
        "Insurance", "Employment", "Family", "Pets", "Vehicle",
        "moving", "visa", "permit", "rent", "buy", "apartment", "house", "realtor",
        "internet", "electricity", "water", "health insurance", "home insurance",
        "car insurance", "job search", "school enrollment", "pet documents",
        "car registration", "money transfer", "international transfer", "banking",
        "shipping", "vet", "school", "lease termination", "local services",
        "travel documents", "connectivity", "mobile plan", "temporary stay", "hotel",
        "AirBNB", "currency exchange", "local authorities", "embassy", "supplies",
        "enrollment", "customs", "regulations", "legal documents", "personal records",
        "education", "pet transport", "pet relocation service", "airline",
        "driving route", "maintenance", "car service", "security deposit",
        "disconnect service", "connect service", "importing car", "exporting car",
        "car title", "IDP", "baggage insurance", "orientation", "shopping",
        "career", "consulate", "registration", "public transport", "commuting",
        "adjustment", "pet care", "animal health", "closing", "property finance"
    ]
    service_keywords_string = ", ".join(service_keywords_list)

    prompt = f"""You are an expert relocation planner. Based on the user's relocation details and the specific task provided, explain why this task is important for their move and suggest relevant service keywords.

User Relocation Details:
- Moving Type: {move_type}
- Destination: {destination}
- Estimated Move Date: {move_date}
- Moving {moving_with_str}
- Vehicle Plan: {vehicle_plan}
- Current Housing: {current_housing if current_housing else 'not specified'}
- New Housing Status: {new_housing}
- Job Secured at Destination: {'Yes' if has_job else 'No'}

Specific Task: "{task_description}"
Stage: {stage}
Original Due Date Hint: {original_due_date}
Original Priority: {original_priority}

Provide:
1. A brief explanation of **why** this task is important for THIS user's move (considering {move_type} to {destination}, moving {moving_with_str}, etc.). Be concise and directly relevant.
2. A concise list of highly specific keywords (maximum 3-5) relevant to this task for service matching. Be as **specific** as possible. Choose from or relate to the following list of potential service identifiers: [{service_keywords_string}].

Format your response as a JSON object with the following keys:
{{
  "importance_explanation": "...",
  "service_keywords": ["...", "..."]
}}
Generate only the JSON object. Do not include any other text or code outside the JSON. Ensure the output is valid JSON.
"""

    try:
        response = ollama.chat(
            model=LLM_MODEL_NAME,
            messages=[{'role': 'user', 'content': prompt}],
            options={'temperature': 0.25}
        )

        llm_output = response['message']['content']
        parsed_output = json.loads(llm_output)

        importance_explanation = parsed_output.get("importance_explanation", "Importance explanation not provided by LLM.")
        service_keywords_raw = parsed_output.get("service_keywords", [])

        recommended_services: List[ServiceRecommendation] = []
        task_keywords = []
        if isinstance(service_keywords_raw, str):
             task_keywords = [keyword.strip().lower() for keyword in service_keywords_raw.split(',') if keyword.strip()]
        elif isinstance(service_keywords_raw, list):
             task_keywords = [k.lower() for k in service_keywords_raw if isinstance(k, str) and k.strip()]
        base_json_keywords = [k.lower() for k in task.get('service_keywords', []) if isinstance(k, str) and k.strip()]
        task_terms_set = set(task_keywords + base_json_keywords)

        CATEGORY_MATCH_SCORE = 2
        KEYWORD_MATCH_SCORE = 1
        MIN_MATCH_SCORE_THRESHOLD = 1

        recommended_services_with_score: List[tuple[ServiceRecommendation, int]] = []

        if service_data:
             for service in service_data:
                 current_match_score = 0
                 service_categories = [cat.lower() for cat in service.get("relevant_categories", []) if isinstance(cat, str)]
                 service_keywords_list = [kw.lower() for kw in service.get("keywords", []) if isinstance(kw, str)]

                 for task_keyword in task_terms_set:
                     if task_keyword in service_categories:
                         current_match_score += CATEGORY_MATCH_SCORE
                     elif task_keyword in service_keywords_list:
                         current_match_score += KEYWORD_MATCH_SCORE

                 if current_match_score >= MIN_MATCH_SCORE_THRESHOLD:
                     required_service_keys = ["id", "name", "description", "url"]
                     if all(k in service for k in required_service_keys):
                          try:
                               recommended_service = ServiceRecommendation(
                                  service_id=service["id"],
                                  name=service["name"],
                                  description=service["description"],
                                  url=service["url"]
                               )
                               if recommended_service not in [s for s, score in recommended_services_with_score]:
                                    recommended_services_with_score.append((recommended_service, current_match_score))
                          except ValidationError as e:
                              print(f"Error validating service data from services.json during single task processing: {e}")
                          except Exception as e:
                              print(f"Unexpected error processing service data: {e}")
                     else:
                          print(f"Skipping malformed service data in services.json during single task processing: Missing required keys. Data: {service}")

        recommended_services_with_score.sort(key=lambda item: item[1], reverse=True)
        recommended_services = [item[0] for item in recommended_services_with_score]

        try:
             return RelocationTask(
                 task_description=task_description,
                 priority=original_priority,
                 due_date=original_due_date,
                 importance_explanation=importance_explanation,
                 recommended_services=recommended_services
             )
        except ValidationError as e:
            print(f"Error validating generated RelocationTask object for task '{task_description}': {e}")
            return None

    except json.JSONDecodeError as e:
        print(f"JSON parsing error from LLM for task '{task_description}': {e}")
        return None
    except Exception as e:
        print(f"Error during LLM interaction or processing for task '{task_description}': {e}")
        return None

@app.post("/generate_tasks")
async def create_relocation_tasks_streaming(quiz_data: QuizFormData):
    print("Received request to generate tasks (streaming).")

    if not all_base_tasks:
        print("Warning: Base checklist data not loaded. Attempting to reload.")
        load_base_checklist_data()
        if not all_base_tasks:
             raise HTTPException(status_code=500, detail="Base checklist data could not be loaded.")

    filtered_base_tasks: List[Dict[str, Any]] = []
    for task in all_base_tasks:
        if check_task_applies(task, quiz_data):
            filtered_base_tasks.append(task)

    print(f"Filtered down to {len(filtered_base_tasks)} tasks based on quiz data.")

    stage_order = {"predeparture": 0, "departure": 1, "arrival": 2}
    filtered_base_tasks.sort(key=lambda task: stage_order.get(task.get('stage', 'unknown'), 99))
    print(f"Sorted tasks for processing order.")

    # Calculate total tasks per stage after filtering
    stage_totals: Dict[str, int] = {"predeparture": 0, "departure": 0, "arrival": 0}
    for task in filtered_base_tasks:
        stage = task.get('stage', 'unknown')
        if stage in stage_totals:
            stage_totals[stage] += 1
        else:
            # Handle unexpected stages if necessary, though the base files define them
            stage_totals[stage] = 1

    print(f"Calculated stage totals: {stage_totals}")

    async def task_generator():
        total_filtered_tasks = len(filtered_base_tasks)

        # Send the total count and stage totals as the first item in the stream
        yield json.dumps({"total_tasks": total_filtered_tasks, "stage_totals": stage_totals}) + "\n"
        print(f"Sent initial totals: Overall={total_filtered_tasks}, Stages={stage_totals}")

        for task in filtered_base_tasks:
            processed_task = await process_single_task_with_llm(task, quiz_data, services_data)
            if processed_task:
                task_data_with_stage = processed_task.model_dump()
                task_data_with_stage['stage'] = task.get('stage', 'unknown')
                task_data_with_stage['category'] = task.get('category', 'default')
                yield json.dumps(task_data_with_stage) + "\n"

    return StreamingResponse(task_generator(), media_type="application/x-ndjson")

def get_chat_response_from_llm(message: str, history: List[Dict[str, str]]) -> str:
  messages = history + [{'role': 'user', 'content': message}]
  print("Sending chat history to LLM:", messages)
  try:
    response = ollama.chat(
      model=LLM_MODEL_NAME,
      messages=messages,
      options={'temperature': 0.25}
    )
    chat_output = response['message']['content']
    print("Received chat response:", chat_output)
    return chat_output
  except Exception as e:
    print(f"Error during chat inference: {e}")
    # Return a friendly error message to the user
    return "Sorry, I'm having trouble connecting right now. Please try again later."

@app.post("/chat")
async def chat_with_llm(payload: Dict[str, Any]):
  message = payload.get("message")
  history = payload.get("history", [])
  if not message:
      raise HTTPException(status_code=400, detail="Message not provided")

  print(f"Received chat message: {message}")
  response_text = get_chat_response_from_llm(message, history)
  return {"response": response_text}

@app.get("/")
async def read_root():
  return {"message": "Smooth Migration LLM Backend is running!"}
