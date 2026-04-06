import google.generativeai as genai
import pandas as pd
import json
import time

# 1. SETUP - Use your new API Key here
API_KEY = "AIzaSyBHYzRL3kocneI2BdlSZjqeebn7lwm0Sws" # Please use a new one!
genai.configure(api_key=API_KEY)

# Use the 1.5-Flash model (Most stable for Free Tier in 2026)
model = genai.GenerativeModel('gemini-2.5-flash')

# 2. THE SYSTEM PROMPT
'''SYSTEM_PROMPT = """
You are a Crisis Response AI. Analyze the list of text reports provided.
Extract the following information into a JSON LIST of objects:
- crisis_type: (e.g., Flood, Fire, Earthquake, Medical)
- location: (City or specific area)
- severity: (Low, Medium, High)
- people_affected: (Number or 'N/A')
- needs_identified: (What is required? e.g., Water, Meds)
- urgency: (Informational OR Immediate Action)

Return ONLY a valid JSON list. Use "N/A" for missing data.
"""
'''
SYSTEM_PROMPT = """
You are a Crisis Response AI. Analyze the report and return a JSON object:

- crisisType: The specific event (e.g., Flood, Fire, Earthquake, Chemical Spill).
- needCategory: Categorize this into one of: [MEDICAL, SHELTER, FOOD, WATER, LOGISTICS].
- severityScore: A number from 1 to 10 based on immediate danger.
- title: A very brief summary (e.g., "Building Fire on Main St").
- requiredSkills: List of skills needed (e.g., ["Search and Rescue", "First Aid"]).

Return ONLY valid JSON.
"""

# 3. BATCH PROCESSING FUNCTION (The "Fast" Way)
def process_crisis_batch(text_list):
    """Processes a list of texts in one single AI call to save quota."""
    combined_text = "\n---\n".join(text_list)

    try:
        response = model.generate_content(
            f"{SYSTEM_PROMPT}\n\nReports to analyze:\n{combined_text}",
            generation_config={"response_mime_type": "application/json"}
        )

        # Wait 6 seconds between batches to stay under Free Tier limits (15 RPM)
        time.sleep(6)

        return json.loads(response.text)
    except Exception as e:
        print(f"Error in batch: {e}")
        return [{"error": str(e)}] * len(text_list)
'''
# 4. RUNNING ON YOUR DATASET
def run_extractor(csv_path, output_path):
    df = pd.read_csv(csv_path)

    # Let's process the first 20 rows for your demo
    demo_df = df.tail(20).copy()
    all_results = []

    print(f"🚀 Starting Extraction on {len(demo_df)} rows...")

    # Process in chunks of 5 to be safe and fast
    batch_size = 5
    for i in range(0, len(demo_df), batch_size):
        batch = demo_df['text'].iloc[i:i+batch_size].tolist()
        print(f"Analyzing rows {i} to {i+batch_size}...")

        batch_results = process_crisis_batch(batch)
        all_results.extend(batch_results)

    # Convert results to a new dataframe and merge
    results_df = pd.DataFrame(all_results)
    final_df = pd.concat([demo_df.reset_index(drop=True), results_df], axis=1)

    # Save results
    final_df.to_csv(output_path, index=False)
    print(f"✅ Success! Data saved to {output_path}")
    return final_df

# --- TO RUN THIS ---
# final_data = run_extractor("your_input_file.csv", "crisis_analysis_results.csv")
# print(final_data.head())

'''
def extract_single_report(text_input):
    """Processes one single sentence and returns the extracted fields."""

    print(f"🚀 Analyzing: '{text_input[:50]}...'")

    try:
        # Use the same SYSTEM_PROMPT we defined earlier
        response = model.generate_content(
            f"{SYSTEM_PROMPT}\n\nReport to analyze:\n{text_input}",
            generation_config={"response_mime_type": "application/json"}
        )

        # Parse the JSON result
        result = json.loads(response.text)

        # If the model returns a list (because of the batch prompt), take the first item
        if isinstance(result, list):
            return result[0]
        return result

    except Exception as e:
        return {"error": str(e)}

# --- HOW TO USE FOR YOUR DEMO ---
user_input = "Massive flooding in downtown Miami, 30 people trapped in a building, need boats immediately!"
analysis = extract_single_report(user_input)

# Print the results nicely
print(json.dumps(analysis, indent=4))
