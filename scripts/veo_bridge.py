
import sys
import json
import os
import base64
import time
import traceback
import requests
from google.auth.transport.requests import Request
import google.auth

# Try to import Vertex AI dependencies
try:
    from google.cloud import aiplatform
    from google.cloud import aiplatform_v1beta1
except ImportError:
    print(json.dumps({
        "error": "Missing Required Dependencies",
        "detail": "google-cloud-aiplatform is not installed."
    }))
    sys.exit(1)

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No config path provided"}))
        sys.exit(1)

    config_path = sys.argv[1]
    
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
    except Exception as e:
        print(json.dumps({"error": f"Failed to read config: {str(e)}"}))
        sys.exit(1)

    # Config extraction
    project_id = config.get('project_id')
    location = config.get('location', 'us-central1')
    key_file_path = config.get('key_file_path')
    prompt = config.get('prompt')
    output_file = config.get('output_file')
    model_id = config.get('model_id', 'veo-3.0-generate-001')
    
    # Auth setup
    creds = None
    if key_file_path:
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = key_file_path
        creds, _ = google.auth.load_credentials_from_file(key_file_path, scopes=["https://www.googleapis.com/auth/cloud-platform"])
    else:
        creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])

    if not creds.valid:
        creds.refresh(Request())
        
    token = creds.token
    
    # 1. Submit Job via REST (Because SDK predictLongRunning is missing/obscure)
    print(json.dumps({"status": "submitting", "message": "Submitting LRO via REST..."}), flush=True)
    
    endpoint = f"https://{location}-aiplatform.googleapis.com/v1beta1/projects/{project_id}/locations/{location}/publishers/google/models/{model_id}:predictLongRunning"
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    instance = {"prompt": prompt}
    # Add other params if needed from config
    
    body = {
        "instances": [instance],
        "parameters": {
            "aspectRatio": config.get('aspect_ratio', '16:9'),
            "durationSeconds": config.get('duration_seconds', 5),
            "sampleCount": 1
        }
    }
    
    resp = requests.post(endpoint, json=body, headers=headers)
    if resp.status_code != 200:
        print(json.dumps({"error": f"REST Error {resp.status_code}", "detail": resp.text}))
        sys.exit(1)
        
    data = resp.json()
    op_name = data.get('name')
    if not op_name:
        print(json.dumps({"error": "No operation name returned", "raw": data}))
        sys.exit(1)
        
    print(json.dumps({"status": "polling", "message": f"Job submitted. Polling gRPC: {op_name}"}), flush=True)
    
    # 2. Poll via gRPC (PredictionServiceClient)
    # Using gRPC to avoid REST 404s on UUIDs
    try:
        client_options = {"api_endpoint": f"{location}-aiplatform.googleapis.com"}
        # Use v1beta1 generic client which has get_operation
        # Actually standard PredictionServiceClient might not have get_operation mixed in effectively in all versions
        # But commonly it does.
        client = aiplatform_v1beta1.PredictionServiceClient(client_options=client_options)
        
        while True:
            # We use the raw name directly. Client should handle it.
            operation = client.get_operation(name=op_name)
            
            if operation.done:
                if operation.error.message:
                    print(json.dumps({"error": "Operation failed", "detail": operation.error.message}))
                    sys.exit(1)
                
                # Success
                # The result is in operation.response key, but it's an Any proto.
                # We need to unpack it or accessing the result via REST logic once done?
                # Or just print the JSON representation of the response.
                
                # Unpacking Any proto in python is tricky without the class.
                # But typically for Veo it returns a raw prediction response.
                
                # Let's try to grab the result from the 'response' field.
                # Since it's 'Any', we might convert to Dict.
                
                # Simpler: If it's done, we can maybe fetch the result via REST if gRPC unpacking is hard?
                # But REST might 404.
                
                # Converting proto to dict
                from google.protobuf.json_format import MessageToDict
                op_dict = MessageToDict(operation._pb)
                
                # Check response
                if 'response' in op_dict:
                    # It's an Any, so it has 'value' (binary) or fields? 
                    # Actually standard Any to Dict conversion might effectively give us the fields?
                     pass

                # If we struggle to unpack, we can TRY to use the REST endpoint now that it exists? 
                # (Sometimes Operations exist after creation).
                
                # Let's assume we can get the video bytes from the unpacked dict.
                # Usually: response['predictions'][0]['bytesBase64Encoded'] (?)
                # Wait, 'response' in operation is the result of the LRO
                
                # Let's dump the raw dict to a temp file for inspection if needed, but we want to finish.
                # Assuming standard PredictResponse inside the Any
                
                # HACK: If we can't easily parse the Any, we just look at the raw bytes if plausible, 
                # OR we try to fetch status again via REST now that we know it is done.
                # But safest is to assume the response structure matches the REST one.
                
                # Let's look for video bytes recursively in the dict
                import re
                
                def find_video_bytes(obj):
                    if isinstance(obj, dict):
                        for k, v in obj.items():
                            if k == 'video' and isinstance(v, str): # base64?
                                return v # unlikely, video is usually key, bytes inside
                            if k == 'bytesBase64Encoded':
                                return v
                            res = find_video_bytes(v)
                            if res: return res
                    elif isinstance(obj, list):
                        for item in obj:
                            res = find_video_bytes(item)
                            if res: return res
                    return None
                
                video_b64 = find_video_bytes(op_dict)
                
                if video_b64:
                    # Write result
                    if output_file:
                        with open(output_file, "wb") as f:
                            f.write(base64.b64decode(video_b64))
                        print(json.dumps({"status": "success", "file": output_file}))
                    else:
                        print(json.dumps({"status": "success", "base64": video_b64}))
                    sys.exit(0)
                else:
                    # Fallback: Try REST to get the result since we know it's done
                    # Maybe the 404 on polling disappears when done? (Unlikely)
                    print(json.dumps({"error": "Could not find video bytes in response", "raw": op_dict}))
                    sys.exit(1)
            
            time.sleep(5)
            
    except Exception as e:
        tb = traceback.format_exc()
        print(json.dumps({"error": "gRPC Polling Failed", "detail": str(e), "trace": tb}))
        sys.exit(1)

if __name__ == "__main__":
    main()
