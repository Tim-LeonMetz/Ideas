function calculateZeros(a, b, c) {
    // Pruefe, ob eine quadratische Gleichung vorliegt.
    if (a === 0) {
        console.error("Koeffizient 'a' darf nicht 0 sein");
        return null;
    }

    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) {
        return { zeros: [], message: "Keine reellen Nullstellen" };
    }

    if (discriminant === 0) {
        const x = -b / (2 * a);
        return { zeros: [x], message: "Eine Nullstelle" };
    }

    const sqrtDiscriminant = Math.sqrt(discriminant);
    const x1 = (-b + sqrtDiscriminant) / (2 * a);
    const x2 = (-b - sqrtDiscriminant) / (2 * a);

    return { zeros: [x1, x2], message: "Zwei Nullstellen" };
}

window.calculateZeros = calculateZeros;
