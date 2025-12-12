
import sys
import json
import os
import base64
import time
import traceback

def _emit(obj, error_file=None):
    try:
        print(json.dumps(obj), flush=True)
    except Exception:
        pass
    if error_file:
        try:
            with open(error_file, 'w', encoding='utf-8') as f:
                json.dump(obj, f)
        except Exception:
            pass

def main():
    if len(sys.argv) < 2:
        _emit({"error": "No config path provided"})
        sys.exit(1)

    config_path = sys.argv[1]
    
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
    except Exception as e:
        _emit({"error": f"Failed to read config: {str(e)}"})
        sys.exit(1)

    error_file = config.get('error_file')

    try:
        try:
            import requests
        except ImportError:
            _emit({
                "error": "Missing Required Dependencies",
                "detail": "requests is not installed. Install via: pip install -r scripts/requirements.txt"
            }, error_file=error_file)
            sys.exit(1)

        try:
            from google.auth.transport.requests import Request
            import google.auth
        except ImportError:
            _emit({
                "error": "Missing Required Dependencies",
                "detail": "google-auth is not installed. Install via: pip install -r scripts/requirements.txt"
            }, error_file=error_file)
            sys.exit(1)

        # Try to import Vertex AI dependencies
        try:
            from google.cloud import aiplatform
            from google.cloud import aiplatform_v1beta1
        except ImportError:
            _emit({
                "error": "Missing Required Dependencies",
                "detail": "google-cloud-aiplatform is not installed. Install via: pip install -r scripts/requirements.txt"
            }, error_file=error_file)
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
        _emit({"status": "submitting", "message": "Submitting LRO via REST..."}, error_file=error_file)

        # Use v1 API (not v1beta1) per official Google docs
        endpoint = f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers/google/models/{model_id}:predictLongRunning"

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        instance = {"prompt": prompt}
        # Add other params if needed from config

        # durationSeconds must be a STRING per official docs
        duration_val = config.get('duration_seconds', 8)
        duration_str = str(duration_val) if isinstance(duration_val, int) else duration_val

        body = {
            "instances": [instance],
            "parameters": {
                "aspectRatio": config.get('aspect_ratio', '16:9'),
                "durationSeconds": duration_str,  # Must be string: "5", "8", etc.
                "sampleCount": 1
            }
        }

        # Add optional parameters if present
        if config.get('resolution'):
            body["parameters"]["resolution"] = config.get('resolution')

        if config.get('person_generation'):
            body["parameters"]["personGeneration"] = config.get('person_generation')

        if config.get('add_watermark') is not None:
            body["parameters"]["addWatermark"] = config.get('add_watermark')

        if config.get('include_rai_reason') is not None:
            body["parameters"]["includeRaiReason"] = config.get('include_rai_reason')

        if config.get('generate_audio') is not None:
            body["parameters"]["generateAudio"] = config.get('generate_audio')

        resp = requests.post(endpoint, json=body, headers=headers)
        if resp.status_code != 200:
            _emit({"error": f"REST Error {resp.status_code}", "detail": resp.text}, error_file=error_file)
            sys.exit(1)

        data = resp.json()
        op_name = data.get('name')
        if not op_name:
            _emit({"error": "No operation name returned", "raw": data}, error_file=error_file)
            sys.exit(1)

        _emit({"status": "polling", "message": f"Job submitted. Polling gRPC: {op_name}"}, error_file=error_file)

        # 2. Poll via fetchPredictOperation REST endpoint (per official Google docs)
        # This is the correct way to poll Veo operations - standard operations API doesn't work with UUID operation IDs
        _emit({"status": "polling", "message": f"Polling via fetchPredictOperation: {op_name}"}, error_file=error_file)

        # Extract model ID from operation name for the fetch endpoint
        # Format: projects/.../models/{model_id}/operations/{op_id}
        import re
        model_match = re.search(r'/models/([^/]+)/operations/', op_name)
        if not model_match:
            _emit({"error": "Could not extract model ID from operation name", "op_name": op_name}, error_file=error_file)
            sys.exit(1)

        model_id_from_op = model_match.group(1)
        fetch_url = f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers/google/models/{model_id_from_op}:fetchPredictOperation"

        max_attempts = 120  # 10 minutes at 5 second intervals
        for attempt in range(max_attempts):
            try:
                # Refresh token if needed
                if not creds.valid:
                    creds.refresh(Request())

                fetch_headers = {
                    "Authorization": f"Bearer {creds.token}",
                    "Content-Type": "application/json"
                }
                fetch_body = {"operationName": op_name}

                fetch_resp = requests.post(fetch_url, json=fetch_body, headers=fetch_headers)

                if fetch_resp.status_code != 200:
                    _emit({"status": "polling", "attempt": attempt + 1, "error": f"HTTP {fetch_resp.status_code}: {fetch_resp.text[:200]}"}, error_file=error_file)
                    time.sleep(5)
                    continue

                result = fetch_resp.json()
                done = result.get('done', False)

                _emit({"status": "polling", "attempt": attempt + 1, "done": done}, error_file=error_file)

                if done:
                    # Check for error
                    if 'error' in result:
                        _emit({"error": "Operation failed", "detail": result['error']}, error_file=error_file)
                        sys.exit(1)

                    # Success - extract video bytes
                    def find_video_bytes(obj):
                        if isinstance(obj, dict):
                            for k, v in obj.items():
                                if k == 'bytesBase64Encoded':
                                    return v
                                res = find_video_bytes(v)
                                if res:
                                    return res
                        elif isinstance(obj, list):
                            for item in obj:
                                res = find_video_bytes(item)
                                if res:
                                    return res
                        return None

                    video_b64 = find_video_bytes(result)

                    if video_b64:
                        if output_file:
                            with open(output_file, "wb") as f:
                                f.write(base64.b64decode(video_b64))
                            _emit({"status": "success", "file": output_file}, error_file=error_file)
                        else:
                            _emit({"status": "success", "base64": video_b64[:100] + "..."}, error_file=error_file)
                        sys.exit(0)
                    else:
                        # Check for GCS URI instead of inline bytes
                        def find_gcs_uri(obj):
                            if isinstance(obj, dict):
                                if 'gcsUri' in obj:
                                    return obj['gcsUri']
                                for v in obj.values():
                                    res = find_gcs_uri(v)
                                    if res:
                                        return res
                            elif isinstance(obj, list):
                                for item in obj:
                                    res = find_gcs_uri(item)
                                    if res:
                                        return res
                            return None

                        gcs_uri = find_gcs_uri(result)
                        if gcs_uri:
                            _emit({"status": "success", "gcsUri": gcs_uri, "message": "Video stored in GCS"}, error_file=error_file)
                            sys.exit(0)

                        _emit({"error": "Could not find video bytes or GCS URI in response", "raw": str(result)[:500]}, error_file=error_file)
                        sys.exit(1)

                time.sleep(5)

            except Exception as e:
                _emit({"status": "polling", "attempt": attempt + 1, "error": str(e)}, error_file=error_file)
                time.sleep(5)

        _emit({"error": "Polling timeout", "attempts": max_attempts}, error_file=error_file)
        sys.exit(1)
    except Exception as e:
        _emit({
            "error": "Unhandled exception",
            "detail": str(e),
            "traceback": traceback.format_exc()
        }, error_file=error_file)
        sys.exit(1)

if __name__ == "__main__":
    main()
