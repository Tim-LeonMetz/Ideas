function normalizeExpression(input) {
    return input
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/ü/g, "u")
        .replace(/Ã¼/g, "u")
        .replace(/\u2212/g, "-")
        .replace(/\u00b2/g, "^2")
        .replace(/×/g, "*")
        .replace(/·/g, "*")
        .replace(/,/g, ".");
}

function prepareExpression(input) {
    const normalizedInput = normalizeExpression(input);

    if (!normalizedInput) {
        return null;
    }

    const withoutEquals = normalizedInput.endsWith("=0")
        ? normalizedInput.slice(0, -2)
        : normalizedInput;

    if (!withoutEquals) {
        return null;
    }

    const withPowers = withoutEquals.replace(/\^/g, "**");
    const withFunctions = withPowers
        .replace(/sin\(/g, "Math.sin(")
        .replace(/cos\(/g, "Math.cos(")
        .replace(/tan\(/g, "Math.tan(")
        .replace(/sqrt\(/g, "Math.sqrt(")
        .replace(/abs\(/g, "Math.abs(")
        .replace(/log\(/g, "Math.log(")
        .replace(/exp\(/g, "Math.exp(");

    const withConstants = withFunctions
        .replace(/\bpi\b/g, "Math.PI")
        .replace(/\be\b/g, "Math.E");

    const withImplicitMultiplication = withConstants
        .replace(/(\d)(x|Math\.)/g, "$1*$2")
        .replace(/(\d)\(/g, "$1*(")
        .replace(/(\))(x|\d|Math\.)/g, "$1*$2")
        .replace(/(x)(\d|Math\.|\()/g, "$1*$2");

    if (!/^[0-9x+\-*/().A-Za-z_]*$/.test(withImplicitMultiplication)) {
        return null;
    }

    return withImplicitMultiplication;
}

function createFunction(input) {
    const expression = prepareExpression(input);

    if (!expression) {
        return null;
    }

    try {
        const fn = new Function("x", "return " + expression + ";");

        if (!hasFiniteSampleValue(fn)) {
            return null;
        }

        return fn;
    } catch (error) {
        return null;
    }
}

function hasFiniteSampleValue(fn) {
    const samplePoints = [0, 1, -1, 2, -2, 0.5, -0.5];

    for (const point of samplePoints) {
        const value = safeEvaluate(fn, point);

        if (value !== null) {
            return true;
        }
    }

    return false;
}

function safeEvaluate(fn, x) {
    try {
        const value = fn(x);
        return Number.isFinite(value) ? value : null;
    } catch (error) {
        return null;
    }
}

function createDerivative(fn) {
    return function (x) {
        const h = Math.max(1e-4, Math.abs(x) * 1e-5);
        const left = safeEvaluate(fn, x - h);
        const right = safeEvaluate(fn, x + h);

        if (left === null || right === null) {
            return null;
        }

        return (right - left) / (2 * h);
    };
}

function createSecondDerivative(fn) {
    const firstDerivative = createDerivative(fn);
    return createDerivative(firstDerivative);
}

function secantMethod(fn, x0, x1, tolerance, maxIterations) {
    let previousX = x0;
    let currentX = x1;
    let previousY = safeEvaluate(fn, previousX);
    let currentY = safeEvaluate(fn, currentX);

    if (previousY === null || currentY === null) {
        return null;
    }

    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
        const denominator = currentY - previousY;

        if (Math.abs(denominator) < 1e-12) {
            return null;
        }

        const nextX = currentX - currentY * (currentX - previousX) / denominator;

        if (!Number.isFinite(nextX)) {
            return null;
        }

        const nextY = safeEvaluate(fn, nextX);

        if (nextY === null) {
            return null;
        }

        if (Math.abs(nextY) < tolerance || Math.abs(nextX - currentX) < tolerance) {
            return nextX;
        }

        previousX = currentX;
        previousY = currentY;
        currentX = nextX;
        currentY = nextY;
    }

    return null;
}

function generateAdaptivePairs() {
    const pairs = [[-1, 1], [0, 1], [-1, 0]];
    let radius = 1;

    for (let shell = 0; shell < 10; shell += 1) {
        const nextRadius = radius * 2;
        const step = radius / 2;

        for (let x = -nextRadius; x < nextRadius; x += step) {
            pairs.push([x, x + step]);
        }

        radius = nextRadius;
    }

    return pairs;
}

function findPointsWithSecant(fn, options) {
    const tolerance = options && options.tolerance ? options.tolerance : 1e-7;
    const uniquenessTolerance = options && options.uniquenessTolerance ? options.uniquenessTolerance : 1e-3;
    const maxIterations = options && options.maxIterations ? options.maxIterations : 50;
    const accept = options && options.accept ? options.accept : function () { return true; };

    const points = [];
    const pairs = generateAdaptivePairs();
    const samples = generateAdaptiveSamples();

    samples.forEach(function (sample) {
        const value = safeEvaluate(fn, sample);

        if (value !== null && Math.abs(value) < 1e-4 && accept(sample)) {
            addUniquePoint(points, sample, uniquenessTolerance);
        }
    });

    pairs.forEach(function (pair) {
        const root = secantMethod(fn, pair[0], pair[1], tolerance, maxIterations);

        if (root === null) {
            return;
        }

        const y = safeEvaluate(fn, root);

        if (y === null || Math.abs(y) > 1e-4 || !accept(root)) {
            return;
        }

        addUniquePoint(points, root, uniquenessTolerance);
    });

    return points.sort(function (a, b) {
        return a - b;
    });
}

function generateAdaptiveSamples() {
    const samples = [0, 1, -1, 2, -2, 0.5, -0.5];
    let radius = 1;

    for (let shell = 0; shell < 10; shell += 1) {
        const nextRadius = radius * 2;
        const step = Math.max(0.25, radius / 4);

        for (let x = -nextRadius; x <= nextRadius; x += step) {
            samples.push(Number(x.toFixed(6)));
        }

        radius = nextRadius;
    }

    return samples;
}

function addUniquePoint(points, candidate, tolerance) {
    const roundedCandidate = Number(candidate.toFixed(6));
    const exists = points.some(function (point) {
        return Math.abs(point - roundedCandidate) < tolerance;
    });

    if (!exists) {
        points.push(roundedCandidate);
    }
}

function findRoots(input) {
    const fn = createFunction(input);

    if (!fn) {
        return null;
    }

    const roots = findPointsWithSecant(fn, {
        tolerance: 1e-8,
        uniquenessTolerance: 1e-3,
        maxIterations: 60
    });

    return {
        zeros: roots,
        message: createResultMessage(roots.length)
    };
}

function createResultMessage(count) {
    if (count === 0) {
        return "Keine Nullstellen gefunden";
    }

    if (count === 1) {
        return "Eine Nullstelle gefunden";
    }

    return count + " Nullstellen gefunden";
}

function analyzeFunction(input) {
    const fn = createFunction(input);

    if (!fn) {
        return null;
    }

    const firstDerivative = createDerivative(fn);
    const secondDerivative = createSecondDerivative(fn);
    const roots = findRoots(input);
    const criticalPoints = findPointsWithSecant(firstDerivative, {
        tolerance: 1e-7,
        uniquenessTolerance: 1e-3,
        maxIterations: 60
    });
    const inflectionCandidates = findPointsWithSecant(secondDerivative, {
        tolerance: 1e-6,
        uniquenessTolerance: 1e-3,
        maxIterations: 60
    });
    const periodicAnalysis = describePeriodicAnalysis(input);
    const normalizedInput = normalizeExpression(input);

    return {
        domain: detectDomain(normalizedInput, fn),
        roots: roots,
        periodicRoots: describePeriodicRoots(input),
        periodicAnalysis: periodicAnalysis,
        yIntercept: safeEvaluate(fn, 0),
        symmetry: detectSymmetry(fn),
        endBehavior: describeEndBehavior(fn),
        asymptotes: detectAsymptotes(normalizedInput, fn),
        extrema: classifyExtrema(fn, firstDerivative, secondDerivative, criticalPoints),
        inflectionPoints: classifyInflectionPoints(fn, secondDerivative, inflectionCandidates),
        monotonicity: buildGlobalBehaviorDescription(firstDerivative, criticalPoints, "monotonicity"),
        curvature: buildGlobalBehaviorDescription(secondDerivative, inflectionCandidates, "curvature")
    };
}

function detectDomain(normalizedInput, fn) {
    if (normalizedInput.includes("log(")) {
        return "eingeschraenkt; Argument von log muss groesser als 0 sein";
    }

    if (normalizedInput.includes("sqrt(")) {
        return "eingeschraenkt; Argument von sqrt muss groesser oder gleich 0 sein";
    }

    const left = safeEvaluate(fn, -1);
    const zero = safeEvaluate(fn, 0);
    const right = safeEvaluate(fn, 1);

    if (left !== null && zero !== null && right !== null) {
        return "naeherungsweise alle reellen Zahlen";
    }

    return "nicht fuer alle reellen Zahlen definiert";
}

function describeEndBehavior(fn) {
    const leftLarge = safeEvaluate(fn, -1000000);
    const rightLarge = safeEvaluate(fn, 1000000);

    return "x -> -inf: " + describeLimitValue(leftLarge) + "; x -> +inf: " + describeLimitValue(rightLarge);
}

function describeLimitValue(value) {
    if (value === null) {
        return "nicht eindeutig bestimmbar";
    }

    if (value > 100000) {
        return "+inf";
    }

    if (value < -100000) {
        return "-inf";
    }

    return formatNumber(value);
}

function detectAsymptotes(normalizedInput, fn) {
    const hints = [];

    if (normalizedInput.includes("tan(")) {
        hints.push("vertikale Asymptoten periodisch vorhanden");
    }

    if (normalizedInput.includes("/")) {
        hints.push("moegliche Polstellen bzw. vertikale Asymptoten");
    }

    const leftLarge = safeEvaluate(fn, -1000000);
    const rightLarge = safeEvaluate(fn, 1000000);

    if (leftLarge !== null && rightLarge !== null && almostEqual(leftLarge, rightLarge)) {
        hints.push("waagerechte Asymptote y = " + formatNumber((leftLarge + rightLarge) / 2));
    }

    return hints.length > 0 ? hints.join(", ") : "keine offensichtlichen Asymptoten erkannt";
}

function classifyExtrema(fn, firstDerivative, secondDerivative, criticalPoints) {
    return criticalPoints.map(function (x) {
        const y = safeEvaluate(fn, x);
        const second = safeEvaluate(secondDerivative, x);
        const left = safeEvaluate(firstDerivative, x - 1e-2);
        const right = safeEvaluate(firstDerivative, x + 1e-2);
        let type = "Extremstelle";

        if (left !== null && right !== null) {
            if (left > 0 && right < 0) {
                type = "Hochpunkt";
            } else if (left < 0 && right > 0) {
                type = "Tiefpunkt";
            }
        } else if (second !== null) {
            if (second > 0) {
                type = "Tiefpunkt";
            } else if (second < 0) {
                type = "Hochpunkt";
            }
        }

        return { x: x, y: y, type: type };
    }).filter(function (point) {
        return point.y !== null;
    });
}

function classifyInflectionPoints(fn, secondDerivative, candidates) {
    return candidates.map(function (x) {
        const y = safeEvaluate(fn, x);
        const left = safeEvaluate(secondDerivative, x - 1e-2);
        const right = safeEvaluate(secondDerivative, x + 1e-2);

        if (y === null || left === null || right === null || left * right > 0) {
            return null;
        }

        return { x: x, y: y };
    }).filter(function (point) {
        return point !== null;
    });
}

function buildGlobalBehaviorDescription(fn, changePoints, type) {
    if (!changePoints || changePoints.length === 0) {
        const sample = safeEvaluate(fn, 0);

        if (sample === null || Math.abs(sample) < 1e-6) {
            return ["Keine eindeutige globale Aussage erkannt"];
        }

        return [createGlobalIntervalText("-inf", "+inf", sample > 0 ? 1 : -1, type)];
    }

    const sortedPoints = changePoints.slice().sort(function (a, b) {
        return a - b;
    });
    const intervals = [];
    const boundaries = [-Infinity].concat(sortedPoints).concat([Infinity]);

    for (let index = 0; index < boundaries.length - 1; index += 1) {
        const left = boundaries[index];
        const right = boundaries[index + 1];
        const samplePoint = chooseSamplePoint(left, right);
        const value = safeEvaluate(fn, samplePoint);

        if (value === null || Math.abs(value) < 1e-6) {
            continue;
        }

        intervals.push(createGlobalIntervalText(left, right, value > 0 ? 1 : -1, type));
    }

    return intervals.length > 0 ? intervals : ["Keine eindeutige globale Aussage erkannt"];
}

function chooseSamplePoint(left, right) {
    if (!Number.isFinite(left)) {
        return Number.isFinite(right) ? right - 1 : 0;
    }

    if (!Number.isFinite(right)) {
        return left + 1;
    }

    return (left + right) / 2;
}

function createGlobalIntervalText(left, right, sign, type) {
    const leftText = formatBoundary(left);
    const rightText = formatBoundary(right);

    if (type === "monotonicity") {
        return sign > 0
            ? "steigend auf (" + leftText + ", " + rightText + ")"
            : "fallend auf (" + leftText + ", " + rightText + ")";
    }

    return sign > 0
        ? "linksgekruemmt auf (" + leftText + ", " + rightText + ")"
        : "rechtsgekruemmt auf (" + leftText + ", " + rightText + ")";
}

function formatBoundary(value) {
    if (value === Infinity) {
        return "+inf";
    }

    if (value === -Infinity) {
        return "-inf";
    }

    return formatNumber(value);
}

function detectSymmetry(fn) {
    let even = true;
    let odd = true;

    for (let x = 1; x <= 5; x += 1) {
        const positive = safeEvaluate(fn, x);
        const negative = safeEvaluate(fn, -x);

        if (positive === null || negative === null) {
            continue;
        }

        if (!almostEqual(positive, negative)) {
            even = false;
        }

        if (!almostEqual(negative, -positive)) {
            odd = false;
        }
    }

    if (even) {
        return "achsensymmetrisch zur y-Achse";
    }

    if (odd) {
        return "punktsymmetrisch zum Ursprung";
    }

    return "keine einfache Symmetrie erkannt";
}

function describePeriodicAnalysis(input) {
    const model = parsePeriodicTrigModel(input);

    if (!model) {
        return null;
    }

    const period = Math.PI / Math.abs(model.linear.a);
    const doublePeriod = 2 * period;
    const amplitudeSign = Math.sign(model.amplitude) || 1;
    const slopeSign = Math.sign(model.amplitude * model.linear.a) || 1;

    if (model.trigFunction === "sin") {
        const maxBase = solveLinear(model.linear, amplitudeSign > 0 ? Math.PI / 2 : 3 * Math.PI / 2);
        const minBase = solveLinear(model.linear, amplitudeSign > 0 ? 3 * Math.PI / 2 : Math.PI / 2);
        const inflectionBase = solveLinear(model.linear, 0);

        return {
            extremaGeneral: "Hochpunkte: x = " + formatNumber(maxBase) + " + k * " + formatPiMultiple(doublePeriod / Math.PI) +
                "; Tiefpunkte: x = " + formatNumber(minBase) + " + k * " + formatPiMultiple(doublePeriod / Math.PI) + ", k in Z",
            inflectionGeneral: "Wendepunkte: x = " + formatNumber(inflectionBase) + " + k * " + formatPiMultiple(period / Math.PI) + ", k in Z",
            monotonicityGeneral: slopeSign > 0
                ? "Monotonie allgemein: steigend zwischen Tiefpunkt und Hochpunkt, fallend zwischen Hochpunkt und Tiefpunkt; Wiederholung mit Periode " + formatPiMultiple(doublePeriod / Math.PI)
                : "Monotonie allgemein: fallend zwischen Tiefpunkt und Hochpunkt, steigend zwischen Hochpunkt und Tiefpunkt; Wiederholung mit Periode " + formatPiMultiple(doublePeriod / Math.PI),
            curvatureGeneral: amplitudeSign > 0
                ? "Kruemmung allgemein: linksgekruemmt fuer sin(ax+b) > 0, rechtsgekruemmt fuer sin(ax+b) < 0; Wechsel bei x = " + formatNumber(inflectionBase) + " + k * " + formatPiMultiple(period / Math.PI) + ", k in Z"
                : "Kruemmung allgemein: linksgekruemmt fuer sin(ax+b) < 0, rechtsgekruemmt fuer sin(ax+b) > 0; Wechsel bei x = " + formatNumber(inflectionBase) + " + k * " + formatPiMultiple(period / Math.PI) + ", k in Z"
        };
    }

    if (model.trigFunction === "cos") {
        const maxBase = solveLinear(model.linear, amplitudeSign > 0 ? 0 : Math.PI);
        const minBase = solveLinear(model.linear, amplitudeSign > 0 ? Math.PI : 0);
        const inflectionBase = solveLinear(model.linear, Math.PI / 2);

        return {
            extremaGeneral: "Hochpunkte: x = " + formatNumber(maxBase) + " + k * " + formatPiMultiple(doublePeriod / Math.PI) +
                "; Tiefpunkte: x = " + formatNumber(minBase) + " + k * " + formatPiMultiple(doublePeriod / Math.PI) + ", k in Z",
            inflectionGeneral: "Wendepunkte: x = " + formatNumber(inflectionBase) + " + k * " + formatPiMultiple(period / Math.PI) + ", k in Z",
            monotonicityGeneral: "Monotonie allgemein wiederholt sich mit Periode " + formatPiMultiple(doublePeriod / Math.PI),
            curvatureGeneral: "Kruemmung allgemein wechselt bei x = " + formatNumber(inflectionBase) + " + k * " + formatPiMultiple(period / Math.PI) + ", k in Z"
        };
    }

    if (model.trigFunction === "tan") {
        const rootBase = solveLinear(model.linear, 0);

        return {
            extremaGeneral: "Keine periodischen Extremstellen",
            inflectionGeneral: "Wendepunkte: x = " + formatNumber(rootBase) + " + k * " + formatPiMultiple(period / Math.PI) + ", k in Z",
            monotonicityGeneral: slopeSign > 0
                ? "Monotonie allgemein: streng steigend auf jedem Definitionsintervall; Wiederholung mit Periode " + formatPiMultiple(period / Math.PI)
                : "Monotonie allgemein: streng fallend auf jedem Definitionsintervall; Wiederholung mit Periode " + formatPiMultiple(period / Math.PI),
            curvatureGeneral: "Kruemmung allgemein wechselt bei x = " + formatNumber(rootBase) + " + k * " + formatPiMultiple(period / Math.PI) + ", k in Z"
        };
    }

    return null;
}

function describePeriodicRoots(input) {
    const model = parsePeriodicTrigModel(input);

    if (!model || !almostEqual(model.shift, 0)) {
        return null;
    }

    if (model.trigFunction === "sin" || model.trigFunction === "tan") {
        return "Allgemein: x = " + formatLinearRootFamily(0, Math.PI, model.linear) + ", k in Z";
    }

    if (model.trigFunction === "cos") {
        return "Allgemein: x = " + formatLinearRootFamily(Math.PI / 2, Math.PI, model.linear) + ", k in Z";
    }

    return null;
}

function parsePeriodicTrigModel(input) {
    const normalizedInput = normalizeExpression(input);

    if (!normalizedInput) {
        return null;
    }

    const expression = normalizedInput.endsWith("=0")
        ? normalizedInput.slice(0, -2)
        : normalizedInput;

    const match = expression.match(/^([+-]?(?:\d*\.?\d+)?)?\*?(sin|cos|tan)\((.+)\)([+-]\d*\.?\d+)?$/);

    if (!match) {
        return null;
    }

    const amplitude = parseLeadingCoefficient(match[1]);
    const trigFunction = match[2];
    const linear = parseLinearExpression(match[3]);
    const shift = match[4] ? Number(match[4]) : 0;

    if (!linear || Number.isNaN(amplitude) || Number.isNaN(shift)) {
        return null;
    }

    return {
        amplitude: amplitude,
        trigFunction: trigFunction,
        linear: linear,
        shift: shift
    };
}

function parseLeadingCoefficient(value) {
    if (value === undefined || value === "" || value === "+") {
        return 1;
    }

    if (value === "-") {
        return -1;
    }

    return Number(value);
}

function parseLinearExpression(expression) {
    const sanitized = expression.replace(/\*/g, "");
    const match = sanitized.match(/^([+-]?(?:\d*\.?\d+)?)?x(?:([+-])(\d*\.?\d+))?$/);

    if (!match) {
        return null;
    }

    const rawA = match[1];
    const sign = match[2];
    const rawB = match[3];

    let a = 1;

    if (rawA === "-") {
        a = -1;
    } else if (rawA && rawA !== "+") {
        a = Number(rawA);
    }

    if (Number.isNaN(a)) {
        return null;
    }

    let b = 0;

    if (rawB) {
        b = Number(rawB) * (sign === "-" ? -1 : 1);
    }

    if (Number.isNaN(b)) {
        return null;
    }

    return { a: a, b: b };
}

function formatLinearRootFamily(offset, period, linearPart) {
    const base = -linearPart.b / linearPart.a + offset / linearPart.a;
    const step = period / linearPart.a;

    return formatNumber(base) + " + k * " + formatPiMultiple(step / Math.PI);
}

function solveLinear(linearPart, target) {
    return (target - linearPart.b) / linearPart.a;
}

function formatPiMultiple(factor) {
    if (almostEqual(factor, 1)) {
        return "pi";
    }

    if (almostEqual(factor, -1)) {
        return "-pi";
    }

    if (almostEqual(Math.abs(factor), 0.5)) {
        return (factor < 0 ? "-" : "") + "pi/2";
    }

    if (almostEqual(Math.abs(factor), 0.25)) {
        return (factor < 0 ? "-" : "") + "pi/4";
    }

    return formatNumber(factor) + "pi";
}

function formatNumber(value) {
    if (almostEqual(value, 0)) {
        return "0";
    }

    return String(Number(value.toFixed(6)));
}

function almostEqual(a, b) {
    return Math.abs(a - b) < 1e-6;
}

window.findRoots = findRoots;
window.createFunction = createFunction;
window.describePeriodicRoots = describePeriodicRoots;
window.analyzeFunction = analyzeFunction;
window.formatNumber = formatNumber;
window.usePrettyGerman = true;
