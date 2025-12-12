"""
Test Vertex AI Veo polling via gRPC (same approach as veo_bridge.py)
"""
import json
import os
import time
import requests
import google.auth
from google.auth.transport.requests import Request

PROJECT_ID = "gen-lang-client-0670058723"
LOCATION = "us-central1"
KEY_FILE = r"C:\Users\Public\gen-lang-client-0670058723-d6d5f9b0dabe.json"

# Full operation names from previous successful submissions
OPERATION_NAMES = [
    "projects/gen-lang-client-0670058723/locations/us-central1/publishers/google/models/veo-3.1-fast-generate-001/operations/fa6b632c-0c70-4d9f-b0f6-7cac444afecb",
]

def main():
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = KEY_FILE
    creds, _ = google.auth.load_credentials_from_file(
        KEY_FILE, 
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    if not creds.valid:
        creds.refresh(Request())
    
    # Try using the LRO operations client directly via gRPC channel
    from google.longrunning import operations_pb2_grpc, operations_pb2
    from google.auth.transport import grpc as google_auth_grpc
    import grpc
    
    # Create authenticated gRPC channel
    channel = google_auth_grpc.secure_authorized_channel(
        creds, 
        Request(), 
        f"{LOCATION}-aiplatform.googleapis.com:443"
    )
    
    # Create operations stub
    stub = operations_pb2_grpc.OperationsStub(channel)
    
    for op_name in OPERATION_NAMES:
        print(f"\nPolling: {op_name[-60:]}")
        
        try:
            request = operations_pb2.GetOperationRequest(name=op_name)
            operation = stub.GetOperation(request)
            print(f"Operation done: {operation.done}")
            
            if operation.done:
                from google.protobuf.json_format import MessageToDict
                op_dict = MessageToDict(operation)
                print(f"Result: {json.dumps(op_dict, indent=2)[:1000]}")
            
        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    main()
