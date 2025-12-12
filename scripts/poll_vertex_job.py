"""
Poll Vertex AI Veo operations using fetchPredictOperation endpoint
Per official docs: https://cloud.google.com/vertex-ai/generative-ai/docs/video/generate-videos-from-first-and-last-frames
"""
import json
import os
import requests
import google.auth
from google.auth.transport.requests import Request

PROJECT_ID = "gen-lang-client-0670058723"
LOCATION = "us-central1"
KEY_FILE = r"C:\Users\Public\gen-lang-client-0670058723-d6d5f9b0dabe.json"

# Full operation names from previous successful submissions
OPERATIONS = [
    {
        "name": "projects/gen-lang-client-0670058723/locations/us-central1/publishers/google/models/veo-3.1-fast-generate-001/operations/fa6b632c-0c70-4d9f-b0f6-7cac444afecb",
        "model": "veo-3.1-fast-generate-001"
    },
    {
        "name": "projects/gen-lang-client-0670058723/locations/us-central1/publishers/google/models/veo-3.1-generate-preview/operations/31875f5e-884e-40c1-b351-62f646bff13f",
        "model": "veo-3.1-generate-preview"
    },
]

def main():
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = KEY_FILE
    creds, _ = google.auth.load_credentials_from_file(
        KEY_FILE, 
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    if not creds.valid:
        creds.refresh(Request())
    
    headers = {
        "Authorization": f"Bearer {creds.token}",
        "Content-Type": "application/json"
    }
    
    # Use fetchPredictOperation endpoint per official docs
    for op in OPERATIONS:
        op_name = op["name"]
        model_id = op["model"]
        
        print(f"\n{'='*60}")
        print(f"Checking operation: {op_name.split('/operations/')[-1]}")
        print(f"Model: {model_id}")
        print(f"{'='*60}")
        
        # fetchPredictOperation endpoint
        url = f"https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{LOCATION}/publishers/google/models/{model_id}:fetchPredictOperation"
        body = {"operationName": op_name}
        
        print(f"\n  URL: {url}")
        print(f"  Body: {json.dumps(body)}")
        
        resp = requests.post(url, json=body, headers=headers)
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            done = data.get('done', False)
            print(f"  Done: {done}")
            print(f"  Response: {json.dumps(data, indent=2)[:500]}...")
            
            if done and 'response' in data:
                print(f"\n  🎉 VIDEO COMPLETE!")
        else:
            print(f"  Response: {resp.text[:200] if resp.text else 'empty'}")

if __name__ == "__main__":
    main()
