/**
 * Berechnet Containervorschlag basierend auf Abrissvolumen
 * @param {number} totalVolumeCbm - Gesamtvolumen in m³ (verdichtet)
 * @returns {Array} Vorgeschlagene Container
 */
const suggestContainers = (totalVolumeCbm) => {
  // Faktor 1.3 für Auflockerungsvolumen (Schüttgut)
  const bulkVolume = +(totalVolumeCbm * 1.3).toFixed(1);

  const containerSizes = [20, 10, 7, 5];
  let remaining = bulkVolume;
  const suggestion = [];

  containerSizes.forEach((size) => {
    const count = Math.floor(remaining / size);
    if (count > 0) {
      suggestion.push({ sizeCubicMeters: size, count });
      remaining -= count * size;
    }
  });

  // Rest immer in kleinsten Container
  if (remaining > 0.1) {
    suggestion.push({ sizeCubicMeters: 5, count: 1 });
  }

  return { estimatedVolumeCbm: +totalVolumeCbm.toFixed(2), bulkVolumeCbm: bulkVolume, suggestion };
};

/**
 * Berechnet Verzögerung in Tagen, Wochen und Prozent
 */
const calculateDelay = (plannedStart, plannedEnd, actualStart, actualEnd) => {
  if (!plannedEnd || !plannedStart) return { days: 0, weeks: 0, percent: 0 };

  const pEnd = new Date(plannedEnd);
  const aEnd = actualEnd ? new Date(actualEnd) : new Date();
  const pStart = new Date(plannedStart);

  const delayDays = Math.max(0, Math.round((aEnd - pEnd) / 86400000));
  const plannedDuration = Math.max(1, (pEnd - pStart) / 86400000);
  const delayPercent = +((delayDays / plannedDuration) * 100).toFixed(1);

  return {
    days: delayDays,
    weeks: +(delayDays / 7).toFixed(1),
    percent: delayPercent,
  };
};

module.exports = { suggestContainers, calculateDelay };
