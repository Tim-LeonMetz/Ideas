const form = document.getElementById("zero-form");
const resultBox = document.getElementById("result");
const analysisBox = document.getElementById("analysis");
const canvas = document.getElementById("graph-canvas");
const context = canvas.getContext("2d");
const minXInput = document.getElementById("min-x");
const maxXInput = document.getElementById("max-x");
const minYInput = document.getElementById("min-y");
const maxYInput = document.getElementById("max-y");
const mainButtons = document.querySelectorAll("[data-main-target]");
const screenButtons = document.querySelectorAll("[data-screen-target]");
const screens = document.querySelectorAll(".screen");

let graphBounds = {
    minX: -10,
    maxX: 10,
    minY: -10,
    maxY: 10
};
let currentFunction = function (x) {
    return x;
};
let currentZeros = [0];

function prettifyGerman(text) {
    return text
        .replace(/Kruemmung/g, "Kr\u00fcmmung")
        .replace(/gekruemmt/g, "gekr\u00fcmmt")
        .replace(/fuer/g, "f\u00fcr")
        .replace(/gueltige/g, "g\u00fcltige")
        .replace(/gueltigen/g, "g\u00fcltigen")
        .replace(/waehle/g, "w\u00e4hle")
        .replace(/verfuegbar/g, "verf\u00fcgbar")
        .replace(/dafuer/g, "daf\u00fcr")
        .replace(/Menue/g, "Men\u00fc")
        .replace(/einfuegen/g, "einf\u00fcgen")
        .replace(/groesser/g, "gr\u00f6\u00dfer")
        .replace(/naeherungsweise/g, "n\u00e4herungsweise")
        .replace(/moegliche/g, "m\u00f6gliche");
}

function setActiveMainMenu(mainTarget) {
    mainButtons.forEach(function (button) {
        button.classList.toggle("is-active", button.dataset.mainTarget === mainTarget);
    });
}

function setActiveScreen(screenId) {
    screens.forEach(function (screen) {
        screen.classList.toggle("is-active", screen.id === screenId);
    });

    screenButtons.forEach(function (button) {
        button.classList.toggle("is-active", button.dataset.screenTarget === screenId);
    });
}

mainButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        setActiveMainMenu(button.dataset.mainTarget);
        setActiveScreen("screen-kurvendiskussion");
    });
});

screenButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        setActiveScreen(button.dataset.screenTarget);
    });
});

function renderResult(text) {
    resultBox.innerHTML = "<h2>Ergebnis</h2><p>" + prettifyGerman(text) + "</p>";
}

function renderAnalysis(analysis) {
    if (!analysis) {
        analysisBox.innerHTML = "<h2>Kurvendiskussion</h2><p>Keine Analyse verf\u00fcgbar.</p>";
        return;
    }

    const hasPeriodicAnalysis = Boolean(analysis.periodicAnalysis);
    let zerosText = "keine gefunden";
    let extremaText = "keine erkannt";
    let inflectionText = "keine erkannt";
    let monotonicityText = analysis.monotonicity.join(", ");
    let curvatureText = analysis.curvature.join(", ");
    const lines = [];

    if (analysis.periodicRoots) {
        zerosText = analysis.periodicRoots;
    } else if (analysis.roots && analysis.roots.zeros.length > 0) {
        zerosText = analysis.roots.zeros.map(function (zero) {
            return window.formatNumber(zero);
        }).join(", ");
    }

    if (hasPeriodicAnalysis) {
        extremaText = analysis.periodicAnalysis.extremaGeneral || "keine erkannt";
        inflectionText = analysis.periodicAnalysis.inflectionGeneral || "keine erkannt";
        monotonicityText = analysis.periodicAnalysis.monotonicityGeneral || monotonicityText;
        curvatureText = analysis.periodicAnalysis.curvatureGeneral || curvatureText;
    } else {
        if (analysis.extrema.length > 0) {
            extremaText = analysis.extrema.map(function (point) {
                return point.type + " (" + window.formatNumber(point.x) + " | " + window.formatNumber(point.y) + ")";
            }).join(", ");
        }

        if (analysis.inflectionPoints.length > 0) {
            inflectionText = analysis.inflectionPoints.map(function (point) {
                return "(" + window.formatNumber(point.x) + " | " + window.formatNumber(point.y) + ")";
            }).join(", ");
        }
    }

    lines.push("<div class=\"analysis-line\"><strong>Definitionsmenge:</strong> " + analysis.domain + "</div>");
    lines.push("<div class=\"analysis-line\"><strong>Symmetrieverhalten:</strong> " + analysis.symmetry + "</div>");
    lines.push("<div class=\"analysis-line\"><strong>Nullstellen:</strong> " + zerosText + "</div>");
    lines.push("<div class=\"analysis-line\"><strong>Schnittpunkt mit der y-Achse:</strong> " + (analysis.yIntercept === null ? "nicht definiert" : "(0 | " + window.formatNumber(analysis.yIntercept) + ")") + "</div>");
    lines.push("<div class=\"analysis-line\"><strong>Grenzverhalten an den R\u00e4ndern der Definitionsmenge:</strong> " + analysis.endBehavior + "</div>");
    lines.push("<div class=\"analysis-line\"><strong>Asymptoten:</strong> " + analysis.asymptotes + "</div>");
    lines.push("<div class=\"analysis-line\"><strong>Extrempunkte und Monotonieverhalten:</strong></div>");
    lines.push("<div class=\"analysis-subline\">Extrempunkte: " + extremaText + "</div>");
    lines.push("<div class=\"analysis-subline\">Monotonieverhalten: " + monotonicityText + "</div>");
    lines.push("<div class=\"analysis-line\"><strong>Wendepunkte und Kr\u00fcmmungsverhalten:</strong></div>");
    lines.push("<div class=\"analysis-subline\">Wendepunkte: " + inflectionText + "</div>");
    lines.push("<div class=\"analysis-subline\">Kr\u00fcmmungsverhalten: " + curvatureText + "</div>");
    lines.push("<div class=\"analysis-line\"><strong>Skizze Graph von f:</strong> im Bereich Funktionsgraph</div>");

    analysisBox.innerHTML = "<h2>Kurvendiskussion</h2><div class=\"analysis-list\">" + prettifyGerman(lines.join("")) + "</div>";
}

function mapX(x) {
    return ((x - graphBounds.minX) / (graphBounds.maxX - graphBounds.minX)) * canvas.width;
}

function mapY(y) {
    return canvas.height - ((y - graphBounds.minY) / (graphBounds.maxY - graphBounds.minY)) * canvas.height;
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

function drawGraph(fn, zeros) {
    context.clearRect(0, 0, canvas.width, canvas.height);

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

    context.strokeStyle = "#d97706";
    context.lineWidth = 3;
    context.beginPath();

    let started = false;

    for (let pixelX = 0; pixelX <= canvas.width; pixelX += 1) {
        const x = graphBounds.minX + (pixelX / canvas.width) * (graphBounds.maxX - graphBounds.minX);
        const y = fn(x);

        if (!Number.isFinite(y) || y < graphBounds.minY - 50 || y > graphBounds.maxY + 50) {
            started = false;
            continue;
        }

        const pixelY = mapY(y);

        if (!started) {
            context.moveTo(pixelX, pixelY);
            started = true;
        } else {
            context.lineTo(pixelX, pixelY);
        }
    }

    context.stroke();

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

function redrawCurrentGraph() {
    if (!updateGraphBounds()) {
        renderResult("Bitte wähle einen gültigen Graphbereich mit min < max.");
        return;
    }

    drawGraph(currentFunction, currentZeros);
}

form.addEventListener("submit", function (event) {
    event.preventDefault();

    const functionInput = document.getElementById("function-input").value;
    const result = window.findRoots(functionInput);
    const fn = window.createFunction(functionInput);
    const periodicDescription = window.describePeriodicRoots(functionInput);
    const analysis = window.analyzeFunction(functionInput);

    if (!result || !fn || !analysis) {
        renderResult("Bitte gib eine gültige Funktion ein, zum Beispiel x^3-2*x-5, x^4-16 oder sin(x).");
        renderAnalysis(null);
        return;
    }

    if (!updateGraphBounds()) {
        renderResult("Bitte wähle einen gültigen Graphbereich mit min < max.");
        renderAnalysis(analysis);
        return;
    }

    currentFunction = fn;
    currentZeros = result.zeros;
    drawGraph(currentFunction, currentZeros);
    renderAnalysis(analysis);

    if (periodicDescription) {
        renderResult(periodicDescription);
        return;
    }

    if (result.zeros.length === 0) {
        renderResult(result.message);
        return;
    }

    const zeros = result.zeros.map(function (zero) {
        return Number(zero.toFixed(4));
    });

    renderResult(result.message + ": " + zeros.join(" und "));
});

[minXInput, maxXInput, minYInput, maxYInput].forEach(function (input) {
    input.addEventListener("input", redrawCurrentGraph);
});

drawGraph(currentFunction, currentZeros);
renderAnalysis(null);
