# Smooth Migration Relocation Planner - Python Backend

## Architecture Overview

The application follows a client-server architecture:

1.  **Ollama:** Runs the LLM model locally on your machine as a background service.
2.  **Python FastAPI Backend:** A web server (this project) that communicates with Ollama to get LLM responses. It receives requests from the Ionic frontend, processes them, interacts with the LLM, and sends structured data back to the frontend. It also enriches the LLM-generated task list with relevant information about your company's services based on a separate data source (`services_data.json`).
3.  **Ionic Frontend:** The mobile application built with Ionic/Angular that runs in your browser or on a device. It provides the user interface for the questionnaire, checklist, and chat, and communicates with the Python backend via HTTP requests. It displays the generated tasks and provides links to relevant services.

All components are designed to run on your local machine for development and testing.

## Prerequisites

Before setting up the Python backend, ensure you have the following installed:

1.  **Python 3.8+:** Download and install Python from [python.org](https://www.python.org/downloads/).
2.  **Ollama:** Ollama is required to run the LLM locally. Follow the instructions in the next section to install it.
3.  **The Ionic Frontend Project:** This backend is part of a larger project. Ensure you have the Ionic frontend code as well, and that you have installed its dependencies (`npm install` or `yarn install`).

## 1. Install Ollama

First, you need to install Ollama, which manages and runs the local LLM.

Go to the official Ollama download page: [https://ollama.com/download](https://ollama.com/download)

## 2. Download the LLM Model

Next, download the required LLM model using your terminal.

Open your terminal and run the following command to pull the recommended model:

```bash
ollama pull llama3.1:8b-instruct-q5_K_M
```

Ensure the model name in your `.env` file matches the one you pul*

**Alternative Model (If Performance is an Issue):**

If the `q5_K_M` model runs too slowly or uses too much memory on your hardware, you can try the `q4_K_M` quantization.

```bash
ollama pull llama3.1:8b-instruct-q4_k_m
```

Remember to update the `LLM_MODEL_NAME` variable in your `.env` file if you use a different model or quantization.

## 3. Python Backend Setup

Now, set up the Python environment and install the necessary libraries for the backend service.

1.  **Navigate to the Backend Directory:**
  Open your terminal and change the directory to the `backend` folder within your project.

  ```bash
  cd path/to/your/smooth-migration/backend
  ```

2.  **Create a Python Virtual Environment:**
  It's highly recommended to use a virtual environment to isolate project dependencies.

  ```bash
  python -m venv .venv
  ```

3.  **Activate the Virtual Environment:**

  *   **On macOS and Linux:**
    ```bash
    source .venv/bin/activate
    ```
  *   **On Windows (Command Prompt):**
    ```bash
    .venv\Scripts\activate.bat
    ```
  *   **On Windows (PowerShell):**
    ```powershell
    .venv\Scripts\Activate.ps1
    ```
  You should see `(.venv)` at the beginning of your terminal prompt when the environment is active.

4.  **Install Python Dependencies:**
  With the virtual environment activated, install the required packages using pip.

  ```bash
  pip install fastapi uvicorn ollama pydantic python-dotenv
  ```
  

  **`backend/.env` Example:**

  ```dotenv
  # Configuration for the LLM Backend
  # Set the name of the Ollama model you want to use
  LLM_MODEL_NAME=llama3.1:8b-instruct-q5_K_M

  # Set the port for the FastAPI server
  BACKEND_PORT=8000

  # Set the origin(s) your Ionic app is running on during development
  # For multiple origins, separate with commas (e.g., "http://localhost:8100,http://192.168.1.100:8100")
  FRONTEND_ORIGINS=http://localhost:8100
  ```
  Make sure the `LLM_MODEL_NAME` matches the model you pulled with Ollama. The `BACKEND_PORT` should match the `backendUrl` configured in your Ionic frontend (`tab_checklist.page.ts` and `tab_chatbot.page.ts`).

## 4. Running the Python Backend

With the setup complete, you can now start the FastAPI backend server.

1.  **Ensure Virtual Environment is Activated:** Make sure you are in the `backend` directory and your `(.venv)` environment is active.
2.  **Run the Server:** Execute the following command:

  ```bash
  uvicorn main:app --reload --host 0.0.0.0 --port 8000
  ```
  (Replace `8000` with your `BACKEND_PORT` if you changed it in `.env`).

  The `--reload` flag will automatically restart the server when you save changes to your Python files.

  You should see output indicating the server is running, typically on `http://127.0.0.1:8000`. Keep this terminal window open and running.

## 5. Running the Full Application

To test the complete application, you need all three components running:

1.  **Start Ollama:** Ensure the Ollama background service is running.
2.  **Start the Python Backend:** Follow the steps in Section 4. Keep the terminal open.
3.  **Start the Ionic Frontend:** Open a *new* terminal window, navigate to the root directory of your Ionic project (`cd path/to/your/smooth-migration`), and run `ionic serve`. Keep this terminal open.
