# TaskHub

TaskHub is a modern, AI-powered internal administration dashboard and task management platform. It streamlines the creation, assignment, and processing of product imagery. The platform automatically handles complex processes like AI-driven background removal, freeing creators to focus on high-quality outputs.

## Features

- **Role-Based Workflows**: Separate, tailored experiences for Administrators and Creators.
- **AI Background Removal**: Seamlessly strips backgrounds from product imagery using the `rembg` local AI model upon image generation.
- **Task Management**: Intelligent task grouping allows assigning the same task to multiple creators cleanly.
- **Task Studio**: A dedicated workspace for creators to generate, review, and finalize image variations.
- **Responsive & Modern UI**: Built with a sleek glassmorphism aesthetic, featuring a dynamic dark/light mode and fully responsive grid layouts.
- **Lightbox Viewing**: High-fidelity, distraction-free product image inspection via centered modal overlays.
- **Real-Time Analytics**: Admin KPI dashboard tracking active tasks, total users, and generation statistics.

## Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Library**: React
- **Styling**: Vanilla CSS with modern Glassmorphism aesthetics
- **Icons**: Lucide React
- **Auth**: Firebase Authentication

### Backend
- **Framework**: Flask (Python)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage Buckets
- **AI Integration**: `rembg` (u2net model) for local background removal
- **Image Processing**: OpenCV, Pillow
- **Concurrency**: Asynchronous daemon threads for image generation

## Setup & Installation

### Prerequisites
- Node.js & npm
- Python 3.10+
- Supabase Project (with a `taskhub-images` public storage bucket)
- Firebase Project (configured for Authentication)

### Backend Configuration
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create a virtual environment and install dependencies:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   pip install -r requirements.txt
   ```
3. Copy the `.env.example` file to `.env` and fill in your Supabase credentials.
4. Run the database migrations located in `backend/migrations/` against your Supabase SQL editor.
5. Start the backend server:
   ```bash
   python app.py
   ```

### Frontend Configuration
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your Firebase configuration keys and backend URL.
4. Start the development server:
   ```bash
   npm run dev
   ```

## Usage

1. Open `http://localhost:3000` in your browser.
2. Sign in using your registered Firebase credentials.
3. If you are an Admin, you will be directed to the Admin Dashboard (`/admin`) where you can create new tasks, assign them, and view platform metrics.
4. If you are a Creator, you will land on the User Dashboard (`/dashboard`) where you can view assigned tasks and launch the Task Studio to generate imagery.
