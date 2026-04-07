
export enum Gender {
  MALE = "MALE",
  FEMALE = "FEMALE"
}

export interface IAAFParams {
  a: number;
  b: number;
  c: number;
}

// IAAF Scoring Formulas: Points = a * (b - Performance)^c for track, Points = a * (Performance - b)^c for field
// Note: These are simplified versions of the official formulas. 
// For real precision, we'd need the full table or exact coefficients for each event.
// I will use a set of standard coefficients for the requested absolute events.

const MALE_COEFFICIENTS: Record<string, IAAFParams & { isField: boolean }> = {
  "100M": { a: 27.17, b: 18.0, c: 1.81, isField: false },
  "200M": { a: 6.33, b: 38.0, c: 1.81, isField: false },
  "400M": { a: 1.66, b: 82.0, c: 1.81, isField: false },
  "800M": { a: 0.125, b: 235.0, c: 1.85, isField: false },
  "1500M": { a: 0.035, b: 480.0, c: 1.85, isField: false },
  "3000M": { a: 0.0105, b: 1005.0, c: 1.85, isField: false },
  "110MV": { a: 5.74352, b: 28.5, c: 1.92, isField: false },
  "400MV": { a: 1.1466, b: 92.0, c: 1.81, isField: false },
  "3000M OBS": { a: 0.00511, b: 1150.0, c: 1.9, isField: false },
  "5000M": { a: 0.00419, b: 1680.0, c: 1.85, isField: false },
  "ALTURA": { a: 8.6, b: 94.0, c: 1.0, isField: true }, // Linear for Outdoor
  "PÉRTIGA": { a: 2.72, b: 138.0, c: 1.0, isField: true },
  "LONGITUD": { a: 2.145, b: 274.0, c: 1.0, isField: true },
  "TRIPLE": { a: 1.063, b: 601.0, c: 1.0, isField: true },
  "PESO": { a: 51.39, b: 1.5, c: 1.05, isField: true },
  "DISCO": { a: 12.91, b: 4.0, c: 1.1, isField: true },
  "MARTILLO": { a: 13.04, b: 7.0, c: 1.05, isField: true },
  "JABALINA": { a: 10.14, b: 7.0, c: 1.08, isField: true },
  "5000M MARCHA": { a: 0.0004, b: 2800.0, c: 2.0, isField: false },
  "4X100M": { a: 0.07811, b: 96.0, c: 1.81, isField: false },
  "4X400M": { a: 0.00499, b: 440.0, c: 1.81, isField: false },
};

const FEMALE_COEFFICIENTS: Record<string, IAAFParams & { isField: boolean }> = {
  "100M": { a: 17.857, b: 21.0, c: 1.81, isField: false },
  "200M": { a: 4.9908, b: 42.5, c: 1.81, isField: false },
  "400M": { a: 1.3428, b: 91.5, c: 1.81, isField: false },
  "800M": { a: 0.11193, b: 254.0, c: 1.88, isField: false },
  "1500M": { a: 0.02883, b: 535.0, c: 1.88, isField: false },
  "3000M": { a: 0.00683, b: 1150.0, c: 1.88, isField: false },
  "100MV": { a: 9.23076, b: 26.7, c: 1.835, isField: false },
  "400MV": { a: 0.99674, b: 103.0, c: 1.81, isField: false },
  "3000M OBS": { a: 0.00385, b: 1320.0, c: 1.9, isField: false },
  "5000M": { a: 0.00272, b: 1920.0, c: 1.88, isField: false },
  "ALTURA": { a: 9.7, b: 75.0, c: 1.0, isField: true },
  "PÉRTIGA": { a: 2.76, b: 55.0, c: 1.0, isField: true },
  "LONGITUD": { a: 2.17, b: 144.0, c: 1.0, isField: true },
  "TRIPLE": { a: 1.01, b: 297.0, c: 1.0, isField: true },
  "PESO": { a: 56.02, b: 1.5, c: 1.05, isField: true },
  "DISCO": { a: 12.33, b: 3.0, c: 1.1, isField: true },
  "MARTILLO": { a: 12.33, b: 3.0, c: 1.1, isField: true },
  "JABALINA": { a: 12.33, b: 3.0, c: 1.1, isField: true },
  "5000M MARCHA": { a: 0.00035, b: 3100.0, c: 2.0, isField: false },
  "4X100M": { a: 0.06506, b: 107.0, c: 1.81, isField: false },
  "4X400M": { a: 0.00398, b: 500.0, c: 1.81, isField: false },
};

export function getCanonicalEventName(eventName: string): string {
  const upper = eventName.toUpperCase();
  // Remove dots/spaces only inside numbers (1.500 -> 1500) or between number and M (100 M -> 100M)
  const normalized = upper.replace(/(\d)[\s\.]+(\d)/g, "$1$2").replace(/(\d)[\s\.]+(M)/g, "$1$2");
  
  if (normalized.includes("4X100")) return "4X100M";
  if (normalized.includes("4X400")) return "4X400M";
  if (normalized.includes("100M") && (normalized.includes("VALLAS") || normalized.includes("V."))) return "100MV";
  if (normalized.includes("110M") && (normalized.includes("VALLAS") || normalized.includes("V."))) return "110MV";
  if (normalized.includes("400M") && (normalized.includes("VALLAS") || normalized.includes("V."))) return "400MV";
  if (normalized.includes("3000M") && (normalized.includes("OBST") || normalized.includes("OBS."))) return "3000M OBS";
  if (normalized.includes("5000M") && normalized.includes("MARCHA")) return "5000M MARCHA";
  
  if (normalized.includes("4X")) return upper; 
  
  const hasHurdles = normalized.includes("VALLAS") || normalized.includes("V.");
  const hasRelay = normalized.includes("4X");
  const hasObstacles = normalized.includes("OBST") || normalized.includes("OBS.");
  const hasMarcha = normalized.includes("MARCHA");

  if (!hasHurdles && !hasRelay && !hasObstacles && !hasMarcha) {
    if (/\b100\b|100M/.test(normalized) && !/\b110\b|110M/.test(normalized)) return "100M";
    if (/\b200\b|200M/.test(normalized)) return "200M";
    if (/\b400\b|400M/.test(normalized)) return "400M";
    if (/\b800\b|800M/.test(normalized)) return "800M";
    if (/\b1500\b|1500M/.test(normalized)) return "1500M";
    if (/\b3000\b|3000M/.test(normalized)) return "3000M";
    if (/\b5000\b|5000M/.test(normalized)) return "5000M";
  }
  
  if (normalized.includes("ALTURA")) return "ALTURA";
  if (normalized.includes("PÉRTIGA") || normalized.includes("PERTIGA")) return "PÉRTIGA";
  if (normalized.includes("LONXITUDE") || normalized.includes("LONGITUD")) return "LONGITUD";
  if (normalized.includes("TRIPLE")) return "TRIPLE";
  if (normalized.includes("PESO")) return "PESO";
  if (normalized.includes("DISCO")) return "DISCO";
  if (normalized.includes("MARTELO") || normalized.includes("MARTILLO")) return "MARTILLO";
  if (normalized.includes("XABALINA") || normalized.includes("JABALINA")) return "JABALINA";
  
  return upper;
}

export function calculateIAAFPoints(eventName: string, mark: string, selectedGender: Gender): number {
  const normalizedEvent = getCanonicalEventName(eventName);
  const coeffs = selectedGender === Gender.MALE ? MALE_COEFFICIENTS[normalizedEvent] : FEMALE_COEFFICIENTS[normalizedEvent];
  if (!coeffs) return 0;

  const performance = parseMarkToSeconds(mark);
  if (isNaN(performance)) return 0;

  let points = 0;
  if (coeffs.isField) {
    // Field events: Points = a * (Performance - b)^c
    let val = performance;
    if (normalizedEvent === "ALTURA" || normalizedEvent === "PÉRTIGA" || normalizedEvent === "LONGITUD" || normalizedEvent === "TRIPLE") {
      val = performance * 100; // Convert m to cm
    }
    if (val > coeffs.b) {
      points = Math.floor(coeffs.a * Math.pow(val - coeffs.b, coeffs.c));
    }
  } else {
    // Track events: Points = a * (b - Performance)^c
    if (performance < coeffs.b) {
      points = Math.floor(coeffs.a * Math.pow(coeffs.b - performance, coeffs.c));
    }
  }

  return Math.max(0, points);
}

function parseMarkToSeconds(mark: string): number {
  if (!mark) return NaN;
  const clean = mark.replace(/[^\d.:,]/g, "").replace(",", ".");
  
  if (clean.includes(":")) {
    const parts = clean.split(":");
    let total = 0;
    for (let i = 0; i < parts.length; i++) {
      total = total * 60 + parseFloat(parts[i]);
    }
    return total;
  }
  
  const parts = clean.split(".");
  if (parts.length >= 3) {
    // MM.SS.cc
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]) + parseFloat(parts[2]) / 100;
  }
  
  return parseFloat(clean);
}

export const MALE_ESTADILLO_EVENTS = [
  "100m", "200m", "400m", "800m", "1500m", "3000m", "5000m",
  "110mv", "400mv", "3000m obs", 
  "Longitud", "Triple", "Pértiga", "Altura", 
  "Martillo", "Peso", "Disco", "Jabalina", "5000m marcha",
  "4x100m", "4x400m"
];

export const FEMALE_ESTADILLO_EVENTS = [
  "100m", "200m", "400m", "800m", "1500m", "3000m", "5000m",
  "100mv", "400mv", "3000m obs", 
  "Longitud", "Triple", "Pértiga", "Altura", 
  "Martillo", "Peso", "Disco", "Jabalina", "5000m marcha",
  "4x100m", "4x400m"
];

export function getGenderFromEventName(eventName: string): Gender | null {
  const upper = eventName.toUpperCase();
  if (upper.includes("MASCULINO") || upper.includes("MASC.") || upper.includes(" HOMES") || upper.includes("HOMBRES")) return Gender.MALE;
  if (upper.includes("FEMININO") || upper.includes("FEM.") || upper.includes(" MULLERES") || upper.includes("MUJERES")) return Gender.FEMALE;
  return null;
}

export function isEstadilloEvent(eventName: string, gender: Gender): boolean {
  const upper = eventName.toUpperCase();
  const normalized = upper.replace(/(\d)[\s\.]+(\d)/g, "$1$2").replace(/(\d)[\s\.]+(M)/g, "$1$2");
  const eventGender = getGenderFromEventName(eventName);
  
  if (gender === Gender.MALE && eventGender === Gender.FEMALE) return false;
  if (gender === Gender.FEMALE && eventGender === Gender.MALE) return false;
  
  const events = gender === Gender.MALE ? MALE_ESTADILLO_EVENTS : FEMALE_ESTADILLO_EVENTS;
  return events.some(e => {
    const upperE = e.toUpperCase();
    
    // Special handling for events that can be confused
    if (upperE === "100MV") return (normalized.includes("100") || normalized.includes("100M")) && (normalized.includes("VALLAS") || normalized.includes("V."));
    if (upperE === "110MV") return (normalized.includes("110") || normalized.includes("110M")) && (normalized.includes("VALLAS") || normalized.includes("V."));
    if (upperE === "400MV") return (normalized.includes("400") || normalized.includes("400M")) && (normalized.includes("VALLAS") || normalized.includes("V."));
    if (upperE === "3000M OBS") return (normalized.includes("3000") || normalized.includes("3000M")) && (normalized.includes("OBST") || normalized.includes("OBS."));
    if (upperE === "5000M MARCHA") return (normalized.includes("5000") || normalized.includes("5000M")) && normalized.includes("MARCHA");
    if (upperE === "4X100M") return normalized.includes("4X100");
    if (upperE === "4X400M") return normalized.includes("4X400");
    
    // Throwing events weight check
    const isThrow = ["PESO", "DISCO", "MARTILLO", "JABALINA"].includes(upperE);
    if (isThrow) {
      if (!normalized.includes(upperE)) return false;
      
      // Normalize for weight checks (remove spaces and commas)
      const weightNormalized = normalized.replace(",", ".");
      
      // If it contains a weight specification, it MUST be the absolute one
      // If it doesn't contain a weight, we assume it's absolute (standard ranking format)
      if (gender === Gender.FEMALE) {
        if (upperE === "PESO" || upperE === "MARTILLO") {
          // Absolute is 4kg. Reject if it mentions 3kg, 2kg, etc.
          if (weightNormalized.includes("3K") || weightNormalized.includes("2K") || (weightNormalized.includes("KG") && !weightNormalized.includes("4K"))) return false;
        }
        if (upperE === "DISCO") {
          // Absolute is 1kg. Reject if it mentions 0.8kg, etc.
          if (weightNormalized.includes("0.8") || weightNormalized.includes("800") || (weightNormalized.includes("KG") && !weightNormalized.includes("1K"))) return false;
        }
        if (upperE === "JABALINA") {
          // Absolute is 600g. Reject if it mentions 500g, 400g, etc.
          if (weightNormalized.includes("500") || weightNormalized.includes("400") || (weightNormalized.includes("G") && !weightNormalized.includes("600"))) return false;
        }
      } else {
        // Male
        if (upperE === "PESO" || upperE === "MARTILLO") {
          // Absolute is 7.26kg (often labeled 7kg or 7,26kg)
          // Reject if it mentions 6kg, 5kg, 4kg, 3kg
          if (weightNormalized.includes("6K") || weightNormalized.includes("5K") || weightNormalized.includes("4K") || weightNormalized.includes("3K")) return false;
        }
        if (upperE === "DISCO") {
          // Absolute is 2kg. Reject if it mentions 1.75, 1.5, 1kg
          if (weightNormalized.includes("1.7") || weightNormalized.includes("1.5") || (weightNormalized.includes("1K") && !weightNormalized.includes("2K"))) return false;
        }
        if (upperE === "JABALINA") {
          // Absolute is 800g. Reject if it mentions 700g, 600g
          if (weightNormalized.includes("700") || weightNormalized.includes("600") || (weightNormalized.includes("G") && !weightNormalized.includes("800"))) return false;
        }
      }
      return true;
    }

    // For individual track events, ensure it's not a relay or hurdles
    const individualTrackEvents = ["100M", "200M", "400M", "800M", "1500M", "3000M", "5000M"];
    if (individualTrackEvents.includes(upperE)) {
       const distance = upperE.replace("M", "");
       // Check if normalized contains the distance (e.g. "1500") as a word or followed by M
       const distanceRegex = new RegExp(`\\b${distance}\\b|${distance}M`, "i");
       if (!distanceRegex.test(normalized)) return false;

       // Must NOT contain hurdles or relay keywords
       if (normalized.includes("VALLAS") || normalized.includes("V.") || normalized.includes("4X") || normalized.includes("OBST") || normalized.includes("OBS.")) return false;
       
       // Additional check for exact-ish match to avoid 100m matching 110m
       if (upperE === "100M" && normalized.includes("110M")) return false;
       
       return true;
    }
    
    return normalized.includes(upperE) || upper.includes(upperE);
  });
}
