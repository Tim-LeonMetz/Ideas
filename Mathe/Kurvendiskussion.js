function normalizeExpression(input) {
    return input
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/\u2212/g, "-")
        .replace(/\u00b2/g, "^2")
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
        .replace(/(\))(x|\d|Math\.)/g, "$1*$2")
        .replace(/(x)(\d|Math\.)/g, "$1*$2");

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
        const testValue = fn(1);

        if (!Number.isFinite(testValue)) {
            return null;
        }

        return fn;
    } catch (error) {
        return null;
    }
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
        const h = 1e-4;
        const left = safeEvaluate(fn, x - h);
        const right = safeEvaluate(fn, x + h);

        if (left === null || right === null) {
            return null;
        }

        return (right - left) / (2 * h);
    };
}

function findRoots(input) {
    const fn = createFunction(input);

    if (!fn) {
        return null;
    }

    const roots = findInterestingPoints(fn, -100, 100, 0.5);

    return {
        zeros: roots,
        message: createResultMessage(roots.length)
    };
}

function bisectRoot(fn, left, right, epsilon) {
    let leftValue = safeEvaluate(fn, left);
    let rightValue = safeEvaluate(fn, right);

    if (leftValue === null || rightValue === null) {
        return null;
    }

    for (let iteration = 0; iteration < 100; iteration += 1) {
        const middle = (left + right) / 2;
        const middleValue = safeEvaluate(fn, middle);

        if (middleValue === null) {
            return null;
        }

        if (Math.abs(middleValue) < epsilon) {
            return middle;
        }

        if (leftValue * middleValue < 0) {
            right = middle;
        } else {
            left = middle;
            leftValue = middleValue;
        }

        if (Math.abs(right - left) < epsilon) {
            return (left + right) / 2;
        }
    }

    return (left + right) / 2;
}

function addRoot(roots, candidate) {
    const roundedCandidate = Number(candidate.toFixed(6));
    const exists = roots.some(function (root) {
        return Math.abs(root - roundedCandidate) < 1e-3;
    });

    if (!exists) {
        roots.push(roundedCandidate);
    }
}

function findInterestingPoints(fn, minX, maxX, step) {
    const points = [];
    let previousX = minX;
    let previousY = safeEvaluate(fn, previousX);

    if (previousY !== null && Math.abs(previousY) < 1e-4) {
        addRoot(points, previousX);
    }

    for (let currentX = minX + step; currentX <= maxX; currentX += step) {
        const currentY = safeEvaluate(fn, currentX);

        if (currentY === null) {
            previousX = currentX;
            previousY = currentY;
            continue;
        }

        if (Math.abs(currentY) < 1e-4) {
            addRoot(points, currentX);
        }

        if (previousY !== null && previousY * currentY < 0) {
            const root = bisectRoot(fn, previousX, currentX, 1e-7);

            if (root !== null) {
                addRoot(points, root);
            }
        }

        previousX = currentX;
        previousY = currentY;
    }

    return points.sort(function (a, b) {
        return a - b;
    });
}

function createResultMessage(count) {
    if (count === 0) {
        return "Keine Nullstellen im Suchbereich gefunden";
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
    const secondDerivative = createDerivative(firstDerivative);
    const roots = findRoots(input);
    const criticalPoints = findInterestingPoints(firstDerivative, -20, 20, 0.25);
    const curvatureZeros = findInterestingPoints(secondDerivative, -20, 20, 0.25);

    return {
        roots: roots,
        periodicRoots: describePeriodicRoots(input),
        yIntercept: safeEvaluate(fn, 0),
        symmetry: detectSymmetry(fn),
        extrema: classifyExtrema(fn, secondDerivative, criticalPoints),
        inflectionPoints: classifyInflectionPoints(fn, secondDerivative, curvatureZeros),
        monotonicity: buildIntervals(firstDerivative, -10, 10, 1, "monotonicity"),
        curvature: buildIntervals(secondDerivative, -10, 10, 1, "curvature")
    };
}

function classifyExtrema(fn, secondDerivative, criticalPoints) {
    return criticalPoints.map(function (x) {
        const y = safeEvaluate(fn, x);
        const curvature = safeEvaluate(secondDerivative, x);
        let type = "Extremstelle";

        if (curvature !== null) {
            if (curvature > 0) {
                type = "Tiefpunkt";
            } else if (curvature < 0) {
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
        const left = safeEvaluate(secondDerivative, x - 0.05);
        const right = safeEvaluate(secondDerivative, x + 0.05);

        if (y === null || left === null || right === null) {
            return null;
        }

        if (left * right > 0) {
            return null;
        }

        return { x: x, y: y };
    }).filter(function (point) {
        return point !== null;
    });
}

function buildIntervals(fn, minX, maxX, step, type) {
    const intervals = [];
    let currentInterval = null;

    for (let x = minX; x <= maxX; x += step) {
        const value = safeEvaluate(fn, x);

        if (value === null || Math.abs(value) < 1e-4) {
            continue;
        }

        const sign = value > 0 ? 1 : -1;

        if (!currentInterval) {
            currentInterval = { start: x, sign: sign };
            continue;
        }

        if (sign !== currentInterval.sign) {
            intervals.push(createIntervalLabel(currentInterval.start, x, currentInterval.sign, type));
            currentInterval = { start: x, sign: sign };
        }
    }

    if (currentInterval) {
        intervals.push(createIntervalLabel(currentInterval.start, maxX, currentInterval.sign, type));
    }

    return intervals;
}

function createIntervalLabel(start, end, sign, type) {
    const left = formatNumber(start);
    const right = formatNumber(end);

    if (type === "monotonicity") {
        return sign > 0
            ? "steigend auf [" + left + ", " + right + "]"
            : "fallend auf [" + left + ", " + right + "]";
    }

    return sign > 0
        ? "linksgekruemmt auf [" + left + ", " + right + "]"
        : "rechtsgekruemmt auf [" + left + ", " + right + "]";
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

function describePeriodicRoots(input) {
    const normalizedInput = normalizeExpression(input);

    if (!normalizedInput) {
        return null;
    }

    const expression = normalizedInput.endsWith("=0")
        ? normalizedInput.slice(0, -2)
        : normalizedInput;

    const trigMatch = expression.match(/^[+-]?(?:\d*\.?\d+\*?)?(sin|cos|tan)\((.+)\)$/);

    if (!trigMatch) {
        return null;
    }

    const trigFunction = trigMatch[1];
    const linearPart = parseLinearExpression(trigMatch[2]);

    if (!linearPart || linearPart.a === 0) {
        return null;
    }

    if (trigFunction === "sin" || trigFunction === "tan") {
        return "Allgemein: x = " + formatLinearRootFamily(0, Math.PI, linearPart) + ", k in Z";
    }

    if (trigFunction === "cos") {
        return "Allgemein: x = " + formatLinearRootFamily(Math.PI / 2, Math.PI, linearPart) + ", k in Z";
    }

    return null;
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
