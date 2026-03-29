const form = document.getElementById("zero-form");
const resultBox = document.getElementById("result");
const analysisBox = document.getElementById("analysis");
const canvas = document.getElementById("graph-canvas");
const context = canvas.getContext("2d");
const functionInput = document.getElementById("function-input");
const minXInput = document.getElementById("min-x");
const maxXInput = document.getElementById("max-x");
const minYInput = document.getElementById("min-y");
const maxYInput = document.getElementById("max-y");
const screenButtons = document.querySelectorAll("[data-screen-target]");
const screens = document.querySelectorAll(".screen");
const defaultTitle = document.title;

let graphBounds = {
    minX: -10,
    maxX: 10,
    minY: -10,
    maxY: 10
};

let currentExpression = "";
let currentGraphPoints = [];
let currentZeros = [];
let currentAsymptotes = [];
let graphUpdateTimer = null;

function prettifyGerman(text) {
    return String(text || "")
        .replace(/ÃƒÆ’Ã‚Â¤/g, "\u00e4")
        .replace(/ÃƒÆ’Ã‚Â¶/g, "\u00f6")
        .replace(/ÃƒÆ’Ã‚Â¼/g, "\u00fc")
        .replace(/ÃƒÂ¤/g, "\u00e4")
        .replace(/ÃƒÂ¶/g, "\u00f6")
        .replace(/ÃƒÂ¼/g, "\u00fc")
        .replace(/Ãƒâ€ž/g, "\u00c4")
        .replace(/Ãƒâ€“/g, "\u00d6")
        .replace(/ÃƒÅ“/g, "\u00dc")
        .replace(/ae/g, "\u00e4")
        .replace(/oe/g, "\u00f6")
        .replace(/ue/g, "\u00fc")
        .replace(/Ae/g, "\u00c4")
        .replace(/Oe/g, "\u00d6")
        .replace(/Ue/g, "\u00dc")
        .replace(/Kruemmung/g, "Kr\u00fcmmung")
        .replace(/gekruemmt/g, "gekr\u00fcmmt")
        .replace(/linksgekr\u00fcmmt/g, "linksgekr\u00fcmmt")
        .replace(/rechtsgekr\u00fcmmt/g, "rechtsgekr\u00fcmmt")
        .replace(/eingeschraenkt/g, "eingeschr\u00e4nkt")
        .replace(/naeherungsweise/g, "n\u00e4herungsweise")
        .replace(/moegliche/g, "m\u00f6gliche")
        .replace(/groesser/g, "gr\u00f6\u00dfer");
}

function setActiveScreen(screenId) {
    screens.forEach(function (screen) {
        screen.classList.toggle("is-active", screen.id === screenId);
    });

    screenButtons.forEach(function (button) {
        button.classList.toggle("is-active", button.dataset.screenTarget === screenId);
    });

    updateDocumentTitle();
}

function updateDocumentTitle() {
    const activeScreenButton = document.querySelector("[data-screen-target].is-active");
    const screenText = activeScreenButton ? prettifyGerman(activeScreenButton.textContent.trim()) : "Kurvendiskussion";
    document.title = "Mathe: " + screenText;
}

screenButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        setActiveScreen(button.dataset.screenTarget);
    });
});

function renderResult(text) {
    resultBox.innerHTML = "<h2>Ergebnis</h2><p>" + prettifyGerman(text) + "</p>";
}

function createAnalysisRow(key, label, value) {
    return "<div class=\"analysis-line\">" +
        "<label class=\"analysis-toggle-inline\">" +
        "<input type=\"checkbox\" data-analysis-toggle=\"" + key + "\" checked>" +
        "<strong>" + label + ":</strong>" +
        "</label>" +
        "<span class=\"analysis-value\" data-analysis-value=\"" + key + "\">" + prettifyGerman(value) + "</span>" +
        "</div>";
}

function wireAnalysisRowToggles() {
    analysisBox.querySelectorAll("[data-analysis-toggle]").forEach(function (checkbox) {
        checkbox.addEventListener("change", function () {
            const key = checkbox.dataset.analysisToggle;
            const value = analysisBox.querySelector("[data-analysis-value=\"" + key + "\"]");

            if (value) {
                value.classList.toggle("is-hidden", !checkbox.checked);
            }
        });
    });
}

function renderAnalysis(analysis) {
    if (!analysis) {
        analysisBox.innerHTML = "<h2>Kurvendiskussion</h2><p>Keine Analyse verfügbar.</p>";
        return;
    }

    const lines = [
        createAnalysisRow("domain", "Definitionsmenge", analysis.domain),
        createAnalysisRow("symmetry", "Symmetrieverhalten", analysis.symmetry),
        createAnalysisRow("roots", "Nullstellen", analysis.roots),
        createAnalysisRow("yIntercept", "Schnittpunkt mit der y-Achse", analysis.y_intercept),
        createAnalysisRow("endBehavior", "Grenzverhalten an den Rändern der Definitionsmenge", analysis.end_behavior),
        createAnalysisRow("asymptotes", "Asymptoten", analysis.asymptotes),
        createAnalysisRow("extrema", "Extrempunkte", analysis.extrema),
        createAnalysisRow("monotonicity", "Monotonieverhalten", analysis.monotonicity),
        createAnalysisRow("inflection", "Wendepunkte", analysis.inflection),
        createAnalysisRow("curvature", "Krümmungsverhalten", analysis.curvature)
    ];

    analysisBox.innerHTML = "<h2>Kurvendiskussion</h2><div class=\"analysis-list\">" + lines.join("") + "</div>";
    wireAnalysisRowToggles();
}

function updateGraphBounds() {
    const nextBounds = {
        minX: Number(minXInput.value),
        maxX: Number(maxXInput.value),
        minY: Number(minYInput.value),
        maxY: Number(maxYInput.value)
    };

    if (
        Number.isNaN(nextBounds.minX) ||
        Number.isNaN(nextBounds.maxX) ||
        Number.isNaN(nextBounds.minY) ||
        Number.isNaN(nextBounds.maxY) ||
        nextBounds.minX >= nextBounds.maxX ||
        nextBounds.minY >= nextBounds.maxY
    ) {
        return false;
    }

    graphBounds = nextBounds;
    return true;
}

function mapX(x) {
    return ((x - graphBounds.minX) / (graphBounds.maxX - graphBounds.minX)) * canvas.width;
}

function mapY(y) {
    return canvas.height - ((y - graphBounds.minY) / (graphBounds.maxY - graphBounds.minY)) * canvas.height;
}

function drawAxes() {
    context.strokeStyle = "#cbd5e1";
    context.lineWidth = 1;

    for (let x = Math.ceil(graphBounds.minX); x <= graphBounds.maxX; x += 1) {
        const pixelX = mapX(x);
        context.beginPath();
        context.moveTo(pixelX, 0);
        context.lineTo(pixelX, canvas.height);
        context.stroke();
    }

    for (let y = Math.ceil(graphBounds.minY); y <= graphBounds.maxY; y += 1) {
        const pixelY = mapY(y);
        context.beginPath();
        context.moveTo(0, pixelY);
        context.lineTo(canvas.width, pixelY);
        context.stroke();
    }

    context.strokeStyle = "#475569";
    context.lineWidth = 2;

    context.beginPath();
    context.moveTo(mapX(0), 0);
    context.lineTo(mapX(0), canvas.height);
    context.stroke();

    context.beginPath();
    context.moveTo(0, mapY(0));
    context.lineTo(canvas.width, mapY(0));
    context.stroke();

    context.fillStyle = "#334155";
    context.font = "16px Segoe UI";
    context.fillText("x", canvas.width - 18, mapY(0) - 10);
    context.fillText("y", mapX(0) + 10, 18);
    context.font = "13px Segoe UI";
    context.fillText("0", mapX(0) + 6, mapY(0) - 6);
}

function drawAsymptotes(asymptotes) {
    context.save();
    context.setLineDash([10, 7]);
    context.lineWidth = 2;
    context.strokeStyle = "#0f766e";

    asymptotes.forEach(function (asymptote) {
        if (asymptote.type === "vertical") {
            if (asymptote.value < graphBounds.minX || asymptote.value > graphBounds.maxX) {
                return;
            }

            const pixelX = mapX(asymptote.value);
            context.beginPath();
            context.moveTo(pixelX, 0);
            context.lineTo(pixelX, canvas.height);
            context.stroke();
            return;
        }

        if (asymptote.type === "horizontal") {
            if (asymptote.value < graphBounds.minY || asymptote.value > graphBounds.maxY) {
                return;
            }

            const pixelY = mapY(asymptote.value);
            context.beginPath();
            context.moveTo(0, pixelY);
            context.lineTo(canvas.width, pixelY);
            context.stroke();
            return;
        }

        if (asymptote.type === "slant") {
            const leftY = asymptote.slope * graphBounds.minX + asymptote.intercept;
            const rightY = asymptote.slope * graphBounds.maxX + asymptote.intercept;

            context.beginPath();
            context.moveTo(mapX(graphBounds.minX), mapY(leftY));
            context.lineTo(mapX(graphBounds.maxX), mapY(rightY));
            context.stroke();
        }
    });

    context.restore();
}

function drawGraph(points, zeros, asymptotes) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawAxes();

    context.strokeStyle = "#d97706";
    context.lineWidth = 3;

    let started = false;
    let previousPoint = null;
    context.beginPath();

    points.forEach(function (point) {
        if (!point) {
            started = false;
            previousPoint = null;
            return;
        }

        const x = point[0];
        const y = point[1];

        if (y < graphBounds.minY - 2 || y > graphBounds.maxY + 2) {
            started = false;
            previousPoint = null;
            return;
        }

        if (previousPoint && Math.abs(y - previousPoint[1]) > (graphBounds.maxY - graphBounds.minY) * 0.8) {
            started = false;
        }

        const pixelX = mapX(x);
        const pixelY = mapY(y);

        if (!started) {
            context.moveTo(pixelX, pixelY);
            started = true;
        } else {
            context.lineTo(pixelX, pixelY);
        }

        previousPoint = point;
    });

    context.stroke();
    drawAsymptotes(asymptotes);

    context.fillStyle = "#9a3412";
    zeros.forEach(function (zero) {
        if (zero < graphBounds.minX || zero > graphBounds.maxX) {
            return;
        }

        context.beginPath();
        context.arc(mapX(zero), mapY(0), 5, 0, Math.PI * 2);
        context.fill();
    });
}

async function requestAnalysis() {
    const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            expression: currentExpression,
            bounds: graphBounds
        })
    });

    const payload = await response.json();

    if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Die Analyse konnte nicht berechnet werden.");
    }

    return payload;
}

async function runAnalysis() {
    if (!updateGraphBounds()) {
        renderResult("Bitte wähle einen gültigen Graphbereich mit min < max.");
        return;
    }

    currentExpression = functionInput.value.trim();

    if (!currentExpression) {
        renderResult("Bitte gib eine Funktion ein.");
        renderAnalysis(null);
        drawGraph([], [], []);
        return;
    }

    try {
        const payload = await requestAnalysis();
        currentGraphPoints = payload.graph.points || [];
        currentZeros = payload.graph.zeros || [];
        currentAsymptotes = payload.graph.asymptotes || [];

        renderResult(payload.resultText);
        renderAnalysis(payload.analysis);
        drawGraph(currentGraphPoints, currentZeros, currentAsymptotes);
    } catch (error) {
        renderResult("Interner Fehler: " + prettifyGerman(error.message));
        renderAnalysis(null);
        drawGraph([], [], []);
    }
}

form.addEventListener("submit", function (event) {
    event.preventDefault();
    runAnalysis();
});

[minXInput, maxXInput, minYInput, maxYInput].forEach(function (input) {
    input.addEventListener("input", function () {
        if (!updateGraphBounds()) {
            renderResult("Bitte wähle einen gültigen Graphbereich mit min < max.");
            return;
        }

        drawGraph(currentGraphPoints, currentZeros, currentAsymptotes);

        if (!currentExpression) {
            return;
        }

        window.clearTimeout(graphUpdateTimer);
        graphUpdateTimer = window.setTimeout(function () {
            runAnalysis();
        }, 180);
    });
});

drawGraph([], [], []);
renderAnalysis(null);
updateDocumentTitle();
