from __future__ import annotations

import sys
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory


PYTHON_DIR = Path(__file__).resolve().parent
WEB_DIR = PYTHON_DIR.parent
ROOT = WEB_DIR.parent
sys.path.insert(0, str(ROOT))

try:
    from Webserver.Mathe.kurvendiskussion_sympy import AnalysisResult, analyze_expression  # noqa: E402
except ImportError:
    from Mathe.kurvendiskussion_sympy import AnalysisResult, analyze_expression  # noqa: E402


app = Flask(__name__)


def parse_bounds(payload: dict) -> tuple[float, float, float | None, float | None]:
    bounds = payload.get("bounds") or {}
    min_x = float(bounds.get("minX", -10))
    max_x = float(bounds.get("maxX", 10))
    min_y = bounds.get("minY")
    max_y = bounds.get("maxY")
    return min_x, max_x, (float(min_y) if min_y is not None else None), (float(max_y) if max_y is not None else None)


@app.get("/")
def index() -> object:
    return send_from_directory(WEB_DIR / "HTML", "index.html")


@app.get("/<path:filename>")
def static_files(filename: str) -> object:
    if filename.endswith(".html"):
        return send_from_directory(WEB_DIR / "HTML", filename)

    if filename.startswith("JavaScript/"):
        return send_from_directory(WEB_DIR, filename)

    if filename == "styles.css":
        return send_from_directory(WEB_DIR, filename)

    return send_from_directory(WEB_DIR, filename)


@app.post("/api/analyze")
def analyze() -> object:
    payload = request.get_json(silent=True) or {}
    expression = payload.get("expression", "")

    try:
        min_x, max_x, min_y, max_y = parse_bounds(payload)
        result: AnalysisResult = analyze_expression(expression, min_x, max_x, min_y=min_y, max_y=max_y)
    except Exception as error:  # noqa: BLE001
        return jsonify({"ok": False, "error": str(error)}), 400

    return jsonify(
        {
            "ok": True,
            "resultText": result.result_text,
            "analysis": result.analysis,
            "graph": result.graph,
        }
    )


if __name__ == "__main__":
    app.run(debug=True, port=5000)
