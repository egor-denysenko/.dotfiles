import http.server
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import unittest


PROVIDERS = Path(__file__).resolve().parents[1]


class CatalogHandler(http.server.BaseHTTPRequestHandler):
    records = []
    requests = []

    def do_GET(self):
        body = json.dumps({"data": self.records}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        self.requests.append(json.loads(self.rfile.read(int(self.headers["Content-Length"]))))
        events = [
            {"type": "message_start", "message": {"id": "msg_test", "type": "message", "role": "assistant", "content": [], "model": "claude-sonnet-6-1", "stop_reason": None, "usage": {"input_tokens": 1, "output_tokens": 1}}},
            {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}},
            {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "OK"}},
            {"type": "content_block_stop", "index": 0},
            {"type": "message_delta", "delta": {"stop_reason": "end_turn", "stop_sequence": None}, "usage": {"output_tokens": 1}},
            {"type": "message_stop"},
        ]
        body = "".join(f"event: {event['type']}\ndata: {json.dumps(event)}\n\n" for event in events).encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        pass


def model(model_id, endpoint, **metadata):
    return {"id": model_id, "supported_endpoints": [endpoint], **metadata}


class ApertureBridgeTest(unittest.TestCase):
    def test_claude_reasoning_uses_adaptive_format(self):
        CatalogHandler.records = [model("claude-sonnet-6-1", "/v1/messages")]
        CatalogHandler.requests = []
        server = http.server.HTTPServer(("127.0.0.1", 0), CatalogHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                (root / "home").mkdir()
                extension = root / "pig/agent/extensions/aperture-bridge"
                extension.mkdir(parents=True)
                (extension / "index.ts").symlink_to(PROVIDERS / "aperture-bridge.ts")
                (extension / "catalog-cache.ts").symlink_to(PROVIDERS / "catalog-cache.ts")
                env = dict(os.environ, HOME=str(root / "home"), PIG_HOME=str(root / "pig"),
                           APERTURE_BRIDGE_ENDPOINT=f"http://127.0.0.1:{server.server_port}")
                result = subprocess.run([
                    "pig", "--model", "aperture-bridge/claude-sonnet-6-1", "--thinking", "high",
                    "--no-session", "--no-mcp", "--no-skills", "--no-prompt-templates",
                    "--no-context-files", "--tools", "bash", "--print", "Reply OK.",
                ], env=env, text=True, capture_output=True, check=True, timeout=60)
                self.assertIn("OK", result.stdout)
                self.assertEqual(len(CatalogHandler.requests), 1)
                request = CatalogHandler.requests[0]
                self.assertEqual(request["thinking"]["type"], "adaptive")
                self.assertEqual(request["output_config"]["effort"], "high")
                self.assertTrue(request["tools"])
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_discovery_reasoning_metadata_and_cached_fallback(self):
        CatalogHandler.records = [
            model("gpt-6.5-nova", "/v1/responses"),
            model("claude-sonnet-6-1", "/v1/messages"),
            model("gpt-4.1", "/v1/responses"),
            model("claude-3-5-sonnet", "/v1/messages"),
            model("unknown-model", "/v1/responses"),
            model("gpt-6.5-chat-only", "/v1/chat/completions"),
            model("gpt-6.5-disabled", "/v1/responses", supports_reasoning=False),
            model("gpt-6.5-explicit-false", "/v1/responses", reasoning=False, supports_reasoning=True),
            model("unknown-reasoner", "/v1/responses", supports_reasoning=True),
        ]
        server = http.server.HTTPServer(("127.0.0.1", 0), CatalogHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                (root / "home").mkdir()
                extension = root / "pig/agent/extensions/aperture-bridge"
                extension.mkdir(parents=True)
                (extension / "index.ts").symlink_to(PROVIDERS / "aperture-bridge.ts")
                (extension / "catalog-cache.ts").symlink_to(PROVIDERS / "catalog-cache.ts")
                env = dict(os.environ, HOME=str(root / "home"), PIG_HOME=str(root / "pig"),
                           APERTURE_BRIDGE_ENDPOINT=f"http://127.0.0.1:{server.server_port}")

                def listing():
                    result = subprocess.run(["pig", "--list-models", "aperture-bridge"],
                                            env=env, text=True, capture_output=True, check=True, timeout=60)
                    return {parts[1]: parts[4] for line in result.stdout.splitlines()
                            if len(parts := line.split()) >= 6 and parts[0] == "aperture-bridge"}

                self.assertEqual(listing(), {
                    "gpt-6.5-nova": "yes", "claude-sonnet-6-1": "yes",
                    "gpt-4.1": "no", "claude-3-5-sonnet": "no", "unknown-model": "no",
                    "gpt-6.5-chat-only": "no", "gpt-6.5-disabled": "no",
                    "gpt-6.5-explicit-false": "no", "unknown-reasoner": "yes",
                })
                CatalogHandler.records = [model("gpt-7-new", "/v1/responses")]
                self.assertEqual(listing(), {"gpt-7-new": "yes"})
                server.shutdown()
                server.server_close()
                self.assertEqual(listing(), {"gpt-7-new": "yes"})
        finally:
            if thread.is_alive():
                server.shutdown()
            server.server_close()
            thread.join()


if __name__ == "__main__":
    unittest.main()
