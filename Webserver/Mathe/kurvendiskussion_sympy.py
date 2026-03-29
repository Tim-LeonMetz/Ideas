from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

import sympy as sp
from sympy.calculus.singularities import singularities
from sympy.calculus.util import continuous_domain
from sympy.parsing.sympy_parser import (
    convert_xor,
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)
from sympy.sets import ImageSet


X = sp.symbols("x", real=True)
TRANSFORMATIONS = standard_transformations + (
    implicit_multiplication_application,
    convert_xor,
)
LOCAL_DICT = {
    "x": X,
    "sin": sp.sin,
    "cos": sp.cos,
    "tan": sp.tan,
    "sqrt": sp.sqrt,
    "abs": sp.Abs,
    "log": sp.log,
    "exp": sp.exp,
    "pi": sp.pi,
    "e": sp.E,
}


@dataclass
class AnalysisResult:
    result_text: str
    analysis: dict[str, str]
    graph: dict[str, Any]


K = sp.symbols("k", integer=True)


def normalize_expression(text: str) -> str:
    normalized = (text or "").strip()
    normalized = normalized.replace("f(x)=", "").replace("y=", "")
    normalized = normalized.replace("−", "-").replace(",", ".")

    if normalized.endswith("=0"):
        normalized = normalized[:-2]

    return normalized.strip()


def parse_user_expression(text: str) -> sp.Expr:
    normalized = normalize_expression(text)

    if not normalized:
        raise ValueError("Bitte gib eine Funktion ein.")

    try:
        expression = parse_expr(
            normalized,
            local_dict=LOCAL_DICT,
            transformations=TRANSFORMATIONS,
            evaluate=True,
        )
    except Exception as error:  # noqa: BLE001
        raise ValueError("Die Funktion konnte nicht gelesen werden.") from error

    if expression.free_symbols - {X}:
        raise ValueError("Es ist nur die Variable x erlaubt.")

    return sp.simplify(expression)


def format_number(value: Any) -> str:
    if value is None:
        return "nicht definiert"

    simplified = sp.simplify(value)

    if simplified is sp.oo:
        return "+inf"

    if simplified is -sp.oo:
        return "-inf"

    if simplified.has(sp.zoo, sp.nan):
        return "nicht definiert"

    if simplified.is_real is False:
        return "nicht reell"

    if simplified.is_Number:
        if simplified.is_Integer:
            return str(int(simplified))

        numeric = float(sp.N(simplified, 12))

        if abs(numeric) < 1e-10:
            numeric = 0.0

        text = f"{numeric:.8f}".rstrip("0").rstrip(".")
        return text or "0"

    return format_expr(simplified)


def format_expr(expr: Any) -> str:
    text = sp.sstr(sp.simplify(expr))
    return (
        text.replace("**", "^")
        .replace("oo", "inf")
        .replace("Abs", "abs")
        .replace("sqrt", "sqrt")
    )


def latex_value(value: Any) -> str:
    if value is None:
        return r"\text{nicht definiert}"

    simplified = sp.simplify(value)

    if simplified is sp.oo:
        return r"+\infty"

    if simplified is -sp.oo:
        return r"-\infty"

    if simplified.has(sp.zoo, sp.nan):
        return r"\text{nicht definiert}"

    if simplified.is_real is False:
        return r"\text{nicht reell}"

    return sp.latex(simplified)


def inline_math(tex: str) -> str:
    return rf"\({tex}\)"


def format_interval(interval: sp.Interval) -> str:
    left_bracket = "[" if not interval.left_open else "("
    right_bracket = "]" if not interval.right_open else ")"
    return (
        f"{left_bracket}{format_number(interval.start)}, "
        f"{format_number(interval.end)}{right_bracket}"
    )


def format_set(set_obj: sp.Set) -> str:
    if set_obj is sp.S.Reals:
        return inline_math(r"\mathbb{R}")

    if set_obj is sp.S.EmptySet:
        return inline_math(r"\varnothing")

    if isinstance(set_obj, sp.Interval):
        return inline_math(sp.latex(set_obj))

    if isinstance(set_obj, sp.Union):
        return inline_math(sp.latex(set_obj))

    if isinstance(set_obj, sp.FiniteSet):
        return inline_math(sp.latex(set_obj))

    return inline_math(sp.latex(set_obj))


def format_solution_set(solution_set: sp.Set) -> str:
    if solution_set is sp.S.EmptySet:
        return "keine"

    if isinstance(solution_set, sp.FiniteSet):
        values = sorted(solution_set, key=sp.default_sort_key)
        return ", ".join(inline_math(latex_value(value)) for value in values)

    if isinstance(solution_set, sp.Union):
        return "; ".join(format_solution_set(arg) for arg in solution_set.args)

    if isinstance(solution_set, ImageSet):
        try:
            variable = solution_set.lamda.variables[0]
            formula = sp.simplify(solution_set.lamda.expr.subs(variable, K))
            if solution_set.base_set == sp.S.Integers:
                return inline_math(rf"x = {sp.latex(formula)},\; k \in \mathbb{{Z}}")
        except Exception:  # noqa: BLE001
            return inline_math(sp.latex(solution_set))

    if isinstance(solution_set, sp.ConditionSet):
        return "keine geschlossene Darstellung gefunden"

    return inline_math(sp.latex(solution_set))


def compute_symmetry(expr: sp.Expr) -> str:
    if sp.simplify(expr.subs(X, -X) - expr) == 0:
        return "achsensymmetrisch zur y-Achse"

    if sp.simplify(expr.subs(X, -X) + expr) == 0:
        return "punktsymmetrisch zum Ursprung"

    return "keine einfache Symmetrie erkannt"


def limit_text(value: Any) -> str:
    try:
        simplified = sp.simplify(value)
        if isinstance(simplified, sp.AccumBounds):
            return "kein endlicher Grenzwert"
        return format_number(simplified)
    except Exception:  # noqa: BLE001
        return "nicht eindeutig bestimmbar"


def compute_end_behavior(expr: sp.Expr) -> str:
    left = sp.limit(expr, X, -sp.oo)
    right = sp.limit(expr, X, sp.oo)
    return (
        inline_math(rf"x \to -\infty") + ": " + (
            limit_text(left) if isinstance(sp.simplify(left), sp.AccumBounds) else inline_math(latex_value(left))
        ) +
        "; " +
        inline_math(rf"x \to +\infty") + ": " + (
            limit_text(right) if isinstance(sp.simplify(right), sp.AccumBounds) else inline_math(latex_value(right))
        )
    )


def _vertical_asymptote_points(expr: sp.Expr, domain: sp.Set) -> list[sp.Expr]:
    try:
        singular_points = singularities(expr, X, domain=sp.S.Reals)
    except Exception:  # noqa: BLE001
        return []

    if not isinstance(singular_points, sp.FiniteSet):
        return []

    found = []
    for point in sorted(singular_points, key=sp.default_sort_key):
        if point not in domain.closure:
            continue

        left = sp.limit(expr, X, point, dir="-")
        right = sp.limit(expr, X, point, dir="+")

        if left in (sp.oo, -sp.oo) or right in (sp.oo, -sp.oo):
            found.append(point)

    return found


def _linear_asymptote_data(expr: sp.Expr, direction: Any) -> dict[str, Any] | None:
    slope = sp.simplify(sp.limit(expr / X, X, direction))

    if slope in (sp.oo, -sp.oo, sp.nan, sp.zoo) or not slope.is_real:
        return None

    intercept = sp.simplify(sp.limit(expr - slope * X, X, direction))

    if intercept in (sp.oo, -sp.oo, sp.nan, sp.zoo) or not intercept.is_real or not intercept.is_number:
        return None

    if slope == 0:
        return {
            "type": "horizontal",
            "value": float(sp.N(intercept)),
        }

    sign = "+" if sp.N(intercept) >= 0 else "-"
    intercept_text = format_number(abs(sp.N(intercept)))
    return {
        "type": "slant",
        "slope": float(sp.N(slope)),
        "intercept": float(sp.N(intercept)),
        "text": f"schiefe Asymptote y = {format_number(slope)}*x {sign} {intercept_text}",
    }


def asymptote_data(expr: sp.Expr, domain: sp.Set) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []

    for point in _vertical_asymptote_points(expr, domain):
        items.append(
            {
                "type": "vertical",
                "value": float(sp.N(point)),
            }
        )

    for direction in (-sp.oo, sp.oo):
        item = _linear_asymptote_data(expr, direction)
        if not item:
            continue

        if item["type"] == "horizontal":
            duplicate = any(
                existing["type"] == "horizontal"
                and abs(existing["value"] - item["value"]) < 1e-9
                for existing in items
            )
            if not duplicate:
                items.append(item)
            continue

        duplicate = any(
            existing["type"] == "slant"
            and abs(existing["slope"] - item["slope"]) < 1e-9
            and abs(existing["intercept"] - item["intercept"]) < 1e-9
            for existing in items
        )
        if not duplicate:
            items.append(item)

    return items


def compute_asymptotes(expr: sp.Expr, domain: sp.Set) -> str:
    hints: list[str] = []

    for item in asymptote_data(expr, domain):
        if item["type"] == "vertical":
            hints.append("vertikale Asymptote " + inline_math(rf"x = {latex_value(item['value'])}"))
        elif item["type"] == "horizontal":
            hints.append("waagerechte Asymptote " + inline_math(rf"y = {latex_value(item['value'])}"))
        elif item["type"] == "slant":
            hints.append(
                "schiefe Asymptote " + inline_math(
                    rf"y = {latex_value(item['slope'])}x + {latex_value(item['intercept'])}"
                )
            )

    return ", ".join(hints) if hints else "keine offensichtlichen Asymptoten erkannt"


def finite_real_points(solution_set: sp.Set) -> list[sp.Expr] | None:
    if isinstance(solution_set, sp.FiniteSet):
        points = [
            sp.simplify(value)
            for value in solution_set
            if value.is_real is not False
        ]
        return sorted(points, key=sp.default_sort_key)

    return None


def classify_extrema(expr: sp.Expr, domain: sp.Set) -> tuple[str, list[sp.Expr]]:
    first_derivative = sp.simplify(sp.diff(expr, X))
    second_derivative = sp.simplify(sp.diff(first_derivative, X))

    if first_derivative == 0:
        return "keine erkannt", []

    critical_set = sp.solveset(sp.Eq(first_derivative, 0), X, domain=domain)
    critical_points = finite_real_points(critical_set)

    if critical_points is None:
        return f"allgemeine kritische Stellen: {format_solution_set(critical_set)}", []

    if not critical_points:
        return "keine erkannt", []

    parts = []
    for point in critical_points:
        curvature = sp.simplify(second_derivative.subs(X, point))
        y_value = sp.simplify(expr.subs(X, point))

        if curvature.is_real and curvature > 0:
            point_type = "Tiefpunkt"
        elif curvature.is_real and curvature < 0:
            point_type = "Hochpunkt"
        else:
            point_type = "kritischer Punkt"

        parts.append(
            f"{point_type} " + inline_math(
                rf"\left({latex_value(point)}, {latex_value(y_value)}\right)"
            )
        )

    return ", ".join(parts), critical_points


def classify_inflection_points(expr: sp.Expr, domain: sp.Set) -> tuple[str, list[sp.Expr]]:
    second_derivative = sp.simplify(sp.diff(expr, X, 2))

    if second_derivative == 0:
        return "keine erkannt", []

    inflection_set = sp.solveset(sp.Eq(second_derivative, 0), X, domain=domain)
    inflection_points = finite_real_points(inflection_set)

    if inflection_points is None:
        return f"allgemein: {format_solution_set(inflection_set)}", []

    if not inflection_points:
        return "keine erkannt", []

    confirmed_points = []
    for point in inflection_points:
        left = sample_expression(second_derivative, float(sp.N(point)) - 0.01)
        right = sample_expression(second_derivative, float(sp.N(point)) + 0.01)

        if left is None or right is None or left == 0 or right == 0:
            continue

        if math.copysign(1, left) != math.copysign(1, right):
            confirmed_points.append(point)

    if not confirmed_points:
        return "keine erkannt", []

    parts = [
        inline_math(
            rf"\left({latex_value(point)}, {latex_value(sp.simplify(expr.subs(X, point)))}\right)"
        )
        for point in confirmed_points
    ]
    return ", ".join(parts), confirmed_points


def interval_components(domain: sp.Set) -> list[sp.Interval]:
    if isinstance(domain, sp.Interval):
        return [domain]

    if isinstance(domain, sp.Union):
        intervals = [arg for arg in domain.args if isinstance(arg, sp.Interval)]
        return intervals

    return [sp.Interval(-sp.oo, sp.oo)]


def sample_expression(expr: sp.Expr, value: float) -> float | None:
    try:
        sampled = complex(sp.N(expr.subs(X, value), 16))
    except Exception:  # noqa: BLE001
        return None

    if abs(sampled.imag) > 1e-8 or not math.isfinite(sampled.real):
        return None

    return float(sampled.real)


def describe_behavior(
    expr: sp.Expr,
    domain: sp.Set,
    change_points: list[sp.Expr],
    positive_text: str,
    negative_text: str,
) -> str:
    if not change_points:
        sample = sample_expression(expr, 0.0)
        if sample is None:
            return "keine eindeutige globale Aussage erkannt"
        if abs(sample) < 1e-9:
            return "konstant bzw. ohne Vorzeichenwechsel erkannt"
        return (
            f"{positive_text} auf der Definitionsmenge"
            if sample > 0
            else f"{negative_text} auf der Definitionsmenge"
        )

    intervals_text: list[str] = []
    for component in interval_components(domain):
        inner_points = [
            point
            for point in change_points
            if component.contains(point) is True
            and point not in (component.start, component.end)
        ]
        boundaries = [component.start, *inner_points, component.end]

        for left, right in zip(boundaries, boundaries[1:]):
            sample_value = choose_sample_point(left, right)
            sample = sample_expression(expr, sample_value)
            if sample is None or abs(sample) < 1e-9:
                continue

            interval_text = format_interval_text(left, right)
            state = positive_text if sample > 0 else negative_text
            intervals_text.append(f"{state} auf {interval_text}")

    return ", ".join(intervals_text) if intervals_text else "keine eindeutige globale Aussage erkannt"


def choose_sample_point(left: Any, right: Any) -> float:
    left_value = -10.0 if left is -sp.oo else float(sp.N(left))
    right_value = 10.0 if right is sp.oo else float(sp.N(right))

    if left is -sp.oo and right is sp.oo:
        return 0.0

    if left is -sp.oo:
        return right_value - 1.0

    if right is sp.oo:
        return left_value + 1.0

    return (left_value + right_value) / 2.0


def format_interval_text(left: Any, right: Any) -> str:
    left_text = r"-\infty" if left is -sp.oo else latex_value(left)
    right_text = r"+\infty" if right is sp.oo else latex_value(right)
    return inline_math(rf"\left({left_text}, {right_text}\right)")


def root_result_text(root_set: sp.Set) -> str:
    if root_set is sp.S.EmptySet:
        return "Keine Nullstellen gefunden"

    finite_points = finite_real_points(root_set)
    if finite_points is None:
        return f"Nullstellen: {format_solution_set(root_set)}"

    if len(finite_points) == 1:
        return "Eine Nullstelle gefunden: " + inline_math(rf"x = {latex_value(finite_points[0])}")

    values = ", ".join(inline_math(rf"x = {latex_value(point)}") for point in finite_points)
    return f"{len(finite_points)} Nullstellen gefunden: {values}"


def graph_points(expr: sp.Expr, min_x: float, max_x: float, samples: int = 500) -> list[Any]:
    if min_x >= max_x:
        raise ValueError("Der Graphbereich ist ungueltig.")

    points: list[Any] = []
    step = (max_x - min_x) / max(samples - 1, 1)

    for index in range(samples):
        x_value = min_x + index * step
        y_value = sample_expression(expr, x_value)
        points.append(None if y_value is None else [x_value, y_value])

    return points


def visible_finite_roots(root_set: sp.Set, min_x: float, max_x: float) -> list[float]:
    finite_points = finite_real_points(root_set) or []
    visible = []

    for point in finite_points:
        numeric = float(sp.N(point))
        if min_x <= numeric <= max_x:
            visible.append(numeric)

    return visible


def analyze_expression(expression_text: str, min_x: float, max_x: float) -> AnalysisResult:
    expr = parse_user_expression(expression_text)
    domain = continuous_domain(expr, X, sp.S.Reals)
    root_set = sp.solveset(sp.Eq(expr, 0), X, domain=domain)
    y_intercept = sp.simplify(expr.subs(X, 0)) if domain.contains(0) is True else None
    extrema_text, critical_points = classify_extrema(expr, domain)
    inflection_text, inflection_points = classify_inflection_points(expr, domain)
    first_derivative = sp.simplify(sp.diff(expr, X))
    second_derivative = sp.simplify(sp.diff(expr, X, 2))
    monotonicity_text = (
        "konstant auf der Definitionsmenge"
        if first_derivative == 0
        else describe_behavior(
            first_derivative,
            domain,
            critical_points,
            "steigend",
            "fallend",
        )
    )
    curvature_text = (
        "nicht gekruemmt"
        if second_derivative == 0
        else describe_behavior(
            second_derivative,
            domain,
            inflection_points,
            "linksgekruemmt",
            "rechtsgekruemmt",
        )
    )

    analysis = {
        "domain": format_set(domain),
        "symmetry": compute_symmetry(expr),
        "roots": format_solution_set(root_set),
        "y_intercept": "nicht definiert"
        if y_intercept is None
        else inline_math(rf"\left(0, {latex_value(y_intercept)}\right)"),
        "end_behavior": compute_end_behavior(expr),
        "asymptotes": compute_asymptotes(expr, domain),
        "extrema": extrema_text,
        "monotonicity": monotonicity_text,
        "inflection": inflection_text,
        "curvature": curvature_text,
        "graph": "im Bereich Funktionsgraph",
    }

    return AnalysisResult(
        result_text=root_result_text(root_set),
        analysis=analysis,
        graph={
            "points": graph_points(expr, min_x, max_x),
            "zeros": visible_finite_roots(root_set, min_x, max_x),
            "asymptotes": asymptote_data(expr, domain),
        },
    )
