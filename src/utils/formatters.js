/**
 * Funcții pentru formatarea numerelor mari și a prețurilor.
 */

export function formatPrice(number) {
    if (typeof number !== 'number') { return 'N/A'; }
    const options = {
        minimumFractionDigits: 2,
        maximumFractionDigits: number < 1 ? 6 : 2,
    };
    return number.toLocaleString('ro-RO', options);
}

export function formatLargeNumber(number) {
    if (typeof number !== 'number') { return 'N/A'; }
    const num = Math.abs(Number(number)); 
    // Trilioane (T), Miliarde (B), Milioane (M)
    if (num >= 1.0e+12) { return (num / 1.0e+12).toFixed(2) + 'T'; }
    if (num >= 1.0e+9) { return (num / 1.0e+9).toFixed(2) + 'B'; }
    if (num >= 1.0e+6) { return (num / 1.0e+6).toFixed(2) + 'M'; }
    return num.toLocaleString('ro-RO', { maximumFractionDigits: 0 });
}