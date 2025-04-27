from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError
from dotenv import load_dotenv
import ollama
import json
import os

from typing import List, Dict, Any
from models import QuizFormData, TaskListOutput

load_dotenv()

# --- Configuration ---
LLM_MODEL_NAME = os.getenv("LLM_MODEL_NAME", "llama3.1:8b-instruct-q5_K_M")
BACKEND_PORT = int(os.getenv("BACKEND_PORT", 8000))
FRONTEND_ORIGINS = os.getenv("FRONTEND_ORIGINS", "http://localhost:8100").split(',')


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

# --- LLM Interaction Service ---
def generate_tasks_with_llm(quiz_data: QuizFormData) -> TaskListOutput:
  """
  Generates a prioritized and dated relocation task list using the LLM.
  Uses Function Calling simulation via prompt engineering.
  """
  # Convert Pydantic model to dictionary for easier prompting
  quiz_data_dict = quiz_data.model_dump()

  # --- Prompt Engineering for Function Calling Simulation ---
  # We instruct the LLM to generate JSON that looks like arguments for a function call.
  # The structure of the 'tasks' argument matches our TaskListOutput Pydantic model.
  # This is more reliable for getting structured output than just asking for JSON.

  prompt = f"""You are an expert relocation planner.
Based on the following user information, generate a prioritized and dated list of relocation tasks categorized into three stages: predeparture, departure, and arrival.

User Information (JSON):
{json.dumps(quiz_data_dict, indent=2)}

Generate the list of tasks. Structure your response as a JSON object containing the arguments to call a hypothetical function named 'create_relocation_plan'.
This hypothetical function accepts three arguments: 'predeparture', 'departure', and 'arrival'.
Each argument must be a list of task objects.
Each task object in the list must have the following keys:
- task_description (string): A clear and concise description of the task.
- priority (string): The priority level, must be one of 'High', 'Medium', or 'Low'.
- due_date (string): A suggested due date or timeframe relative to the move date (e.g., '8 weeks before move', '1 week after arrival') or a specific date if inferable (e.g., 'YYYY-MM-DD').

Prioritize tasks related to securing housing, immigration documents (if international), and essential logistics (like movers, flights) as 'High'.
Tasks related to packing non-essentials, setting up non-critical services, or finding local amenities can be 'Medium' or 'Low' priority.
Be realistic with dates/timeframes based on the move date '{quiz_data.moveDate}' and whether the move is '{quiz_data.moveType}'.

Example of desired output structure (within the 'create_relocation_plan' function call arguments):
{{
  "predeparture": [
  {{
    "task_description": "Example pre-departure task",
    "priority": "High",
    "due_date": "4 weeks before move"
  }}
  // ... other pre-departure tasks
  ],
  "departure": [
  {{
    "task_description": "Example departure task",
    "priority": "Medium",
    "due_date": "Day of move"
  }}
    // ... other departure tasks
  ],
  "arrival": [
  {{
    "task_description": "Example arrival task",
    "priority": "Low",
    "due_date": "1 week after arrival"
  }}
    // ... other arrival tasks
  ]
}}

Generate only the JSON object representing the arguments for the 'create_relocation_plan' function. Do not include any other text or code outside the JSON.
"""
  print("Sending prompt to LLM...")
  print(prompt) # Log the prompt for debugging

  try:
    # Call Ollama API
    response = ollama.chat(
      model=LLM_MODEL_NAME,
      messages=[{'role': 'user', 'content': prompt}],               # OI OVER HERE FOR TESTING!!!!!
      # TEST FURTHER
      # options={'temperature': 0.7}
    )

    llm_output = response['message']['content']
    print("Received raw LLM output:")
    print(llm_output) # Log raw output

    # Attempt to parse the JSON output
    # The LLM should ideally return just the JSON object.
    parsed_output = json.loads(llm_output)

    # Validate the parsed output against the Pydantic model
    task_list = TaskListOutput(**parsed_output)

    return task_list

  except json.JSONDecodeError as e:
    print(f"JSON parsing error: {e}")
    print(f"Raw LLM output that failed to parse: {llm_output}")
    raise HTTPException(status_code=500, detail=f"Failed to parse LLM response as JSON: {e}")
  except ValidationError as e:
    print(f"Pydantic validation error: {e}")
    print(f"Parsed LLM output that failed validation: {parsed_output}")
    raise HTTPException(status_code=500, detail=f"LLM response did not match expected schema: {e}")
  except Exception as e:
    print(f"Error during LLM inference: {e}")
    raise HTTPException(status_code=500, detail=f"Error generating tasks: {e}")

def get_chat_response_from_llm(message: str, history: List[Dict[str, str]]) -> str:
  """
  Gets a chat response from the LLM.
  """
  messages = history + [{'role': 'user', 'content': message}]
  print("Sending chat history to LLM:", messages)
  try:
    response = ollama.chat(
      model=LLM_MODEL_NAME,
      messages=messages,
      # options={'temperature': 0.8}
    )
    chat_output = response['message']['content']
    print("Received chat response:", chat_output)
    return chat_output
  except Exception as e:
    print(f"Error during chat inference: {e}")
    # Return a friendly error message to the user
    return "Sorry, I'm having trouble connecting right now. Please try again later."


# --- API Endpoints ---

@app.post("/generate_tasks", response_model=TaskListOutput)
async def create_relocation_tasks(quiz_data: QuizFormData):
  """
  Receives quiz data and returns a generated task list.
  """
  print("Received request to generate tasks.")
  task_list = generate_tasks_with_llm(quiz_data)
  print("Tasks generated successfully.")
  return task_list

@app.post("/chat")
async def chat_with_llm(payload: Dict[str, Any]):
  """
  Receives a chat message and history and returns a response.
  """
  message = payload.get("message")
  history = payload.get("history", []) # Expect history as a list of {'role': 'user'/'assistant', 'content': '...'}
  if not message:
      raise HTTPException(status_code=400, detail="Message not provided")

  print(f"Received chat message: {message}")
  response_text = get_chat_response_from_llm(message, history)
  return {"response": response_text}

@app.get("/")
async def read_root():
  return {"message": "Smooth Migration LLM Backend is running!"}
