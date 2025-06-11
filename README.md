# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create a `.env.local` file in this directory and add your keys:
   ```
   GEMINI_API_KEY=your_gemini_api_key
   OPENAI_API_KEY=your_openai_api_key
   DATABASE_URL=your_database_url
   ```
   **Do not commit this file or any `.env*` files to git.**
3. Run the app:
   `npm run dev`
