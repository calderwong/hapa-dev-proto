"""
Test Vertex AI Veo video generation with official API format.
Run with: python scripts/test_vertex_video.py
"""

import json
import os
import time
import requests
import google.auth
from google.auth.transport.requests import Request

# Config - matches official Google sample
PROJECT_ID = "gen-lang-client-0670058723"
LOCATION = "us-central1"
MODEL_ID = "veo-3.1-fast-generate-001"  # Per official docs
KEY_FILE = r"C:\Users\Public\gen-lang-client-0670058723-d6d5f9b0dabe.json"

# Test image URL (public)
TEST_IMAGE_URL = "https://s2-111386.kwimgs.com/bs2/mmu-aiplatform-temp/kling/20240620/1.jpeg"

def main():
    print("Vertex AI Veo Video Generation Test")
    print("=" * 50)
    
    # Auth
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = KEY_FILE
    creds, _ = google.auth.load_credentials_from_file(
        KEY_FILE, 
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    if not creds.valid:
        creds.refresh(Request())
    
    token = creds.token
    print(f"Token: {token[:20]}...")
    
    # Build request per official Google docs
    endpoint = f"https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{LOCATION}/publishers/google/models/{MODEL_ID}:predictLongRunning"
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Request body per official sample - with image URL for first-last-frame model
    body = {
        "instances": [
            {
                "prompt": "A gentle camera zoom with soft lighting",
                "image": {
                    "gcsUri": TEST_IMAGE_URL,
                    "mimeType": "image/jpeg"
                }
            }
        ],
        "parameters": {
            "aspectRatio": "16:9",
            "sampleCount": 1,
            "durationSeconds": "8",  # STRING per official docs
            "personGeneration": "allow_all",
            "addWatermark": True,
            "includeRaiReason": True,
            "generateAudio": True,
            "resolution": "720p"  # lowercase per official docs
        }
    }
    
    print(f"\nEndpoint: {endpoint}")
    print(f"\nRequest body:\n{json.dumps(body, indent=2)}")
    
    # Submit
    print("\nSubmitting job...")
    resp = requests.post(endpoint, json=body, headers=headers)
    
    print(f"Response status: {resp.status_code}")
    data = resp.json()
    print(f"Response:\n{json.dumps(data, indent=2)}")
    
    if resp.status_code != 200:
        print(f"\n❌ FAILED: {data}")
        return
    
    op_name = data.get('name')
    if not op_name:
        print("\n❌ No operation name returned")
        return
    
    print(f"\n✅ Job submitted! Operation: {op_name}")
    
    # Poll for completion using Operations client
    print("\nPolling for completion...")
    
    try:
        from google.longrunning import operations_pb2_grpc
        from google.longrunning import operations_pb2
        import grpc
        from google.auth.transport import grpc as google_auth_grpc
        
        # Create gRPC channel with auth
        channel = google_auth_grpc.secure_authorized_channel(
            creds, 
            Request(), 
            f"{LOCATION}-aiplatform.googleapis.com:443"
        )
        stub = operations_pb2_grpc.OperationsStub(channel)
        
        for attempt in range(60):
            time.sleep(5)
            try:
                request = operations_pb2.GetOperationRequest(name=op_name)
                operation = stub.GetOperation(request)
                print(f"  Attempt {attempt + 1}: done={operation.done}")
                
                if operation.done:
                    if operation.error.message:
                        print(f"\n❌ Error: {operation.error.message}")
                    else:
                        from google.protobuf.json_format import MessageToDict
                        op_dict = MessageToDict(operation._pb)
                        print(f"\n🎉 SUCCESS!")
                        print(f"Response:\n{json.dumps(op_dict, indent=2)}")
                        
                        # Try to find video bytes
                        def find_video(obj):
                            if isinstance(obj, dict):
                                for k, v in obj.items():
                                    if k == 'bytesBase64Encoded':
                                        return v
                                    res = find_video(v)
                                    if res: return res
                            elif isinstance(obj, list):
                                for item in obj:
                                    res = find_video(item)
                                    if res: return res
                            return None
                        
                        video_b64 = find_video(op_dict)
                        if video_b64:
                            import base64
                            with open("test_video_output.mp4", "wb") as f:
                                f.write(base64.b64decode(video_b64))
                            print(f"Video saved to: test_video_output.mp4")
                    return
            except Exception as e:
                print(f"  Attempt {attempt + 1}: error={e}")
        
        print("\n⏰ Timeout after 60 attempts")
        return
        
    except ImportError:
        print("gRPC client not available, falling back to REST...")
    
    # Fallback to REST polling
    poll_url = f"https://{LOCATION}-aiplatform.googleapis.com/v1/{op_name}"
    print(f"Poll URL: {poll_url}")
    
    for attempt in range(60):
        time.sleep(5)
        poll_resp = requests.get(poll_url, headers=headers)
        
        print(f"  Attempt {attempt + 1}: status={poll_resp.status_code}")
        
        if poll_resp.status_code == 404:
            # Try alternative paths
            alt_urls = [
                f"https://{LOCATION}-aiplatform.googleapis.com/v1beta1/{op_name}",
                # Strip model path and use just operations
                f"https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{LOCATION}/operations/{op_name.split('/operations/')[-1]}"
            ]
            for alt_url in alt_urls:
                alt_resp = requests.get(alt_url, headers=headers)
                if alt_resp.status_code == 200:
                    print(f"    Found at: {alt_url}")
                    poll_resp = alt_resp
                    break
        
        if poll_resp.status_code != 200:
            print(f"    Response: {poll_resp.text[:200] if poll_resp.text else 'empty'}")
            continue
            
        poll_data = poll_resp.json()
        done = poll_data.get('done', False)
        print(f"    done={done}")
        
        if done:
            if 'error' in poll_data:
                print(f"\n❌ Error: {poll_data['error']}")
            else:
                print(f"\n🎉 SUCCESS!")
                print(f"Response:\n{json.dumps(poll_data, indent=2)}")
            return
    
    print("\n⏰ Timeout after 60 attempts")

if __name__ == "__main__":
    main()
