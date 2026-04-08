
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { RankingData, RankingEntry, RankingSection } from "../types";

function isValidTeam(teamName: string): boolean {
  if (!teamName) return false;
  const upper = teamName.toUpperCase();
  // Exclude dates (DD/MM/YYYY, DD-MM-YYYY, etc.)
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(teamName)) return false;
  // Exclude common metadata
  if (upper.includes("FEDERACIÓN") || 
      upper.includes("PÁXINA") || 
      upper.includes("PAGINA") ||
      upper.includes("CONTIDOS") ||
      upper.includes("WWW.")) return false;
  return true;
}

export function parseRankingCSV(csvContent: string): RankingData {
  // Normalize non-breaking spaces and other weird whitespace
  const normalizedContent = csvContent.replace(/\xa0/g, " ");
  
  // Use PapaParse for robust CSV parsing
  const results = Papa.parse(normalizedContent, {
    delimiter: ";",
    skipEmptyLines: true,
    transform: (value) => value.trim()
  });

  const rows = results.data as string[][];
  const sections: RankingSection[] = [];
  const teamsSet = new Set<string>();
  const eventsSet = new Set<string>();

  let currentSection: RankingSection | null = null;

  const isLikelyEventName = (text: string) => {
    if (!text) return false;
    const upper = text.toUpperCase();
    
    // Exclude common metadata/footer strings
    if (upper.includes("FEDERACIÓN GALEGA") || 
        upper.includes("RÚA") || 
        upper.includes("CONTIDOS") || 
        upper.includes("PÁXINA") ||
        upper.includes("WWW.ATLETISMO.GAL") ||
        /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(text)) { // Exclude dates
      return false;
    }

    // Include if it has athletics keywords or starts with distance
    const keywords = [
      "MASCULINO", "FEMININO", "MASC.", "FEM.", 
      "SALTO", "LANZAMENTO", "RELEVOS", "COMBINADAS", "MARCHA",
      "LONXITUDE", "TRIPLE", "ALTURA", "PÉRTIGA", "PESO", "DISCO", "XABALINA", "MARTELO",
      "LONGITUD", "PERTIGA", "JABALINA", "MARTILLO"
    ];
    if (keywords.some(k => upper.includes(k))) return true;
    
    // Check for patterns like "60M", "100M", "1.000M", "5KM"
    if (/^\d+/.test(text) && (upper.includes("M") || upper.includes("KM"))) return true;
    
    // If it's short and uppercase, it might be an event
    return text.length >= 2 && text === text.toUpperCase() && /[A-Z]/.test(text);
  };

  for (const row of rows) {
    if (row.length === 0) continue;

    // Check if it's an event header (e.g., "50M MASCULINO ;;;;;;;;")
    // Usually one non-empty cell followed by many empty ones
    const nonEmptyCells = row.filter(cell => cell.length > 0);
    
    if (nonEmptyCells.length === 1 && isLikelyEventName(nonEmptyCells[0])) {
      const eventName = nonEmptyCells[0];
      console.log(`Encontrada sección: ${eventName}`);
      currentSection = { eventName, entries: [] };
      sections.push(currentSection);
      eventsSet.add(eventName);
      continue;
    }

    // Identify data rows: starts with a number (rank) and has enough columns
    if (currentSection && row.length >= 7 && /^\d+$/.test(row[0])) {
      let teamName = row[6] || "";
      if (!isValidTeam(teamName)) {
        teamName = "";
      }

      const entry: RankingEntry = {
        rank: row[0] || "",
        mark: row[1] || "",
        wind: row[2] || "",
        position: row[3] || "",
        athlete: row[4] || "",
        year: row[5] || "",
        team: teamName,
        date: row[7] || "",
        location: row[8] || "",
      };
      
      currentSection.entries.push(entry);
      if (teamName) {
        teamsSet.add(teamName);
      }
    }
  }

  // Filter out sections that ended up with no entries
  const validSections = sections.filter(s => s.entries.length > 0);
  const validEvents = new Set(validSections.map(s => s.eventName));

  return {
    sections: validSections,
    allTeams: Array.from(teamsSet).sort(),
    allEvents: Array.from(validEvents),
  };
}

export async function parseRankingFile(file: File): Promise<RankingData> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv") {
    const text = await file.text();
    return parseRankingCSV(text);
  } else if (extension === "xls" || extension === "xlsx") {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const csv = XLSX.utils.sheet_to_csv(worksheet, { FS: ";" });
    return parseRankingCSV(csv);
  } else {
    throw new Error("Unsupported file format. Please upload CSV or XLS/XLSX.");
  }
}

export function mergeRankingData(data1: RankingData, data2: RankingData): RankingData {
  const mergedSectionsMap = new Map<string, Map<string, RankingEntry>>();
  
  const processData = (data: RankingData) => {
    for (const section of data.sections) {
      if (!mergedSectionsMap.has(section.eventName)) {
        mergedSectionsMap.set(section.eventName, new Map());
      }
      const eventMap = mergedSectionsMap.get(section.eventName)!;
      
      for (const entry of section.entries) {
        if (!entry.athlete) continue;
        const athleteKey = `${entry.athlete.toUpperCase().trim()}-${entry.year}`;
        const existingEntry = eventMap.get(athleteKey);
        
        if (!existingEntry) {
          eventMap.set(athleteKey, { ...entry });
        } else {
          // Compare marks
          if (isBetterMark(entry.mark, existingEntry.mark, section.eventName)) {
            eventMap.set(athleteKey, { ...entry });
          }
        }
      }
    }
  };

  processData(data1);
  processData(data2);

  const sections: RankingSection[] = [];
  const teamsSet = new Set<string>();
  const eventsSet = new Set<string>();

  for (const [eventName, entriesMap] of mergedSectionsMap.entries()) {
    const entries = Array.from(entriesMap.values());
    
    // Re-rank entries based on mark
    const isDistance = isDistanceEvent(eventName);
    entries.sort((a, b) => {
      const valA = parseMark(a.mark);
      const valB = parseMark(b.mark);
      
      // Handle NaN values (put them at the end)
      if (isNaN(valA) && isNaN(valB)) return 0;
      if (isNaN(valA)) return 1;
      if (isNaN(valB)) return -1;

      return isDistance ? valB - valA : valA - valB;
    });

    // Assign new ranks
    entries.forEach((entry, index) => {
      entry.rank = (index + 1).toString();
      if (entry.team && isValidTeam(entry.team)) {
        teamsSet.add(entry.team);
      } else {
        entry.team = ""; // Clean up if it was invalid
      }
    });

    sections.push({ eventName, entries });
    eventsSet.add(eventName);
  }

  return {
    sections: sections,
    allTeams: Array.from(teamsSet).sort(),
    allEvents: Array.from(eventsSet),
  };
}

function isBetterMark(newMark: string, oldMark: string, eventName: string): boolean {
  const valNew = parseMark(newMark);
  const valOld = parseMark(oldMark);
  
  if (isNaN(valNew)) return false;
  if (isNaN(valOld)) return true;

  return isDistanceEvent(eventName) ? valNew > valOld : valNew < valOld;
}

function isDistanceEvent(eventName: string): boolean {
  const upper = eventName.toUpperCase();
  const distanceKeywords = [
    "SALTO", "LONXITUDE", "TRIPLE", "ALTURA", "PÉRTIGA", 
    "LANZAMENTO", "PESO", "DISCO", "XABALINA", "MARTELO",
    "LONGITUD", "PERTIGA", "JABALINA", "MARTILLO"
  ];
  return distanceKeywords.some(k => upper.includes(k));
}

function parseMark(mark: string): number {
  if (!mark) return NaN;
  
  // Remove non-numeric characters except dots and colons
  // Handle 1:23.45 or 1.23.45 format
  const clean = mark.replace(/[^\d.:,]/g, "").replace(",", ".");
  
  // Handle HH:MM:SS or MM:SS.cc
  if (clean.includes(":")) {
    const parts = clean.split(":");
    let total = 0;
    for (let i = 0; i < parts.length; i++) {
      total = total * 60 + parseFloat(parts[i]);
    }
    return total;
  }
  
  // Handle MM.SS.cc (common in some rankings)
  const parts = clean.split(".");
  if (parts.length >= 3) {
    // If we have 3 or more parts with dots, it's likely MM.SS.cc
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]) + parseFloat(parts[2]) / 100;
  }
  
  return parseFloat(clean);
}
