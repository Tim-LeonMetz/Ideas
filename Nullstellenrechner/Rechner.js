function calculateZeros(a, b, c) {
    // Überprüfe ob a !== 0 (sonst keine quadratische Gleichung)
    if (a === 0) {
        console.error("Koeffizient 'a' darf nicht 0 sein");
        return null;
    }

    // Diskriminante berechnen
    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) {
        return { zeros: [], message: "Keine reellen Nullstellen" };
    }

    if (discriminant === 0) {
        // Eine Nullstelle
        const x = -b / (2 * a);
        return { zeros: [x], message: "Eine Nullstelle" };
    }

    // Zwei Nullstellen
    const sqrtDiscriminant = Math.sqrt(discriminant);
    const x1 = (-b + sqrtDiscriminant) / (2 * a);
    const x2 = (-b - sqrtDiscriminant) / (2 * a);

    return { zeros: [x1, x2], message: "Zwei Nullstellen" };
}

// Beispiel
const result = calculateZeros(1, -5, 6); // x² - 5x + 6 = 0
console.log(result); // { zeros: [3, 2], message: "Zwei Nullstellen" }