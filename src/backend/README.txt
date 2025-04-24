This README provides instructions for setting up the Python backend service component of the Relocation Planner application. This service uses a local Large Language Model (LLM) via Ollama to generate personalized relocation checklists.

========================================

  INSTALL OLLAMA
  ========================================

First, you need to install Ollama, which manages and runs the local LLM.

  Go to the official Ollama download page: https://ollama.com/download

  Download and install the appropriate version for your operating system (Windows, macOS, Linux).

======================================== 2. DOWNLOAD THE LLM MODEL

Next, download the required LLM model using your terminal. We recommend starting with the Q5_K_M quantization for a good balance of performance and quality.

ollama pull llama3.1:8b-instruct-q5_K_M

Alternative Model (If Performance is an Issue):
If the Q5_K_M model runs too slowly on your hardware, you can try the Q4_K_M quantization. This will likely be faster but may result in slightly lower quality output.

ollama pull llama3.1:8b-instruct-q4_k_m
======================================== 3. CREATE SPECIFIC OLLAMA MODEL NAME (REQUIRED)

The Python application expects the model to be available under a specific name ('relocation-planner' by default, defined in the .env file). You need to create this named model from the one you just pulled.

  Create a file named 'Modelfile' (no extension) in a temporary location with the following content, referencing the model you pulled in the previous step:
  Modelfile for Relocation Planner

  FROM llama3.1:8b-instruct-q5_K_M
  Or use: FROM llama3.1:8b-instruct-q4_k_m if you downloaded the alternative
  Optional: Add a system prompt or other parameters if desired
  SYSTEM """You are an expert relocation planner AI."""
  PARAMETER temperature 0.6

  Open your terminal and run the 'ollama create' command, pointing to your Modelfile. Make sure the name matches the OLLAMA_MODEL_NAME in your .env file (default is 'relocation-planner').
  Adjust the path '/path/to/your/Modelfile' accordingly

  ollama create relocation-planner -f /path/to/your/Modelfile

======================================== 4. INSTALL PYTHON DEPENDENCIES

Install them directly:

pip install fastapi uvicorn ollama pydantic python-dotenv requests
======================================== 5. CONFIGURE ENVIRONMENT VARIABLES

The backend uses a '.env' file for configuration.

  Ensure there is a file named '.env' inside the 'backend' directory.

  Verify its contents, ensuring OLLAMA_MODEL_NAME matches the name you used in 'ollama create' (Step 3):
  backend/.env

  OLLAMA_API_BASE_URL=http://localhost:11434
  OLLAMA_MODEL_NAME=relocation-planner
  REQUEST_TIMEOUT=60

======================================== 6. RUN OLLAMA

Make sure the Ollama application is running in the background. You usually start it like any other application on your system. It needs to be running for the Python backend to communicate with the LLM.
======================================== 7. RUN THE BACKEND SERVICE

Finally, run the Python FastAPI application using Uvicorn. Make sure you are still in the 'backend' directory in your terminal:

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

--reload: Enables auto-reloading for development (optional).
--host 0.0.0.0: Makes the server accessible from other devices on your network (e.g., for testing the Ionic app on a phone).
--port 8000: Specifies the port the API will run on.
======================================== 8. ACCESSING THE API

Once the Uvicorn server is running:

  The API is live at: http://localhost:8000