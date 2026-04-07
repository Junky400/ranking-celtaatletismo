import React, { useState, useMemo, useRef } from "react";
import { 
  Upload, 
  Filter, 
  ChevronDown, 
  Search, 
  X, 
  Trophy, 
  Calendar, 
  MapPin, 
  Users,
  FileSpreadsheet,
  AlertCircle,
  Check,
  Download
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { RankingData, RankingEntry, RankingSection } from "./types";
import { parseRankingFile, mergeRankingData, parseRankingCSV } from "./utils/parser";
import { calculateIAAFPoints, isEstadilloEvent, Gender, MALE_ESTADILLO_EVENTS, FEMALE_ESTADILLO_EVENTS, getCanonicalEventName, getGenderFromEventName } from "./services/iaafService";
import * as XLSX from "xlsx";
import { useEffect } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_CLUBS_MALE_KEY = "ranking_galego_default_clubs_male";
const DEFAULT_CLUBS_FEMALE_KEY = "ranking_galego_default_clubs_female";
const INITIAL_DEFAULT_CLUBS_MALE = ["RCVPO", "STOC", "MAZPO", "BAIPO", "VCGPO", "PORPO", "SAMPO"];
const INITIAL_DEFAULT_CLUBS_FEMALE = ["CAFPO", "PUROR", "PORPO", "VCGPO", "NAOC", "SAMPO"];

const CURRENT_YEAR = new Date().getFullYear();
const U23_BIRTH_YEAR = CURRENT_YEAR - 22;

const isU23OrYounger = (yearStr: string) => {
  if (!yearStr) return false;
  let year = parseInt(yearStr);
  if (isNaN(year)) return false;
  
  // Handle 2-digit years
  if (year < 100) {
    // If year is 00-26, it's 2000-2026
    // If year is 27-99, it's 1927-1999
    if (year <= (CURRENT_YEAR % 100)) {
      year += 2000;
    } else {
      year += 1900;
    }
  }
  
  return year >= U23_BIRTH_YEAR;
};

export default function App() {
  const [view, setView] = useState<"RANKING" | "ESTADILLO">("RANKING");
  const [rankingData, setRankingData] = useState<RankingData | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamSearch, setTeamSearch] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [tempClubsMale, setTempClubsMale] = useState("");
  const [tempClubsFemale, setTempClubsFemale] = useState("");
  const [topLimit, setTopLimit] = useState<number | null>(null);
  const [rankingGender, setRankingGender] = useState<Gender>(Gender.MALE);
  const [rankingMainTeam, setRankingMainTeam] = useState("RCVPO");
  const [rankingU23OnlyForFilials, setRankingU23OnlyForFilials] = useState(false);

  const [defaultClubsMale, setDefaultClubsMale] = useState<string[]>(() => {
    const saved = localStorage.getItem(DEFAULT_CLUBS_MALE_KEY);
    return saved ? JSON.parse(saved) : INITIAL_DEFAULT_CLUBS_MALE;
  });

  const [defaultClubsFemale, setDefaultClubsFemale] = useState<string[]>(() => {
    const saved = localStorage.getItem(DEFAULT_CLUBS_FEMALE_KEY);
    return saved ? JSON.parse(saved) : INITIAL_DEFAULT_CLUBS_FEMALE;
  });

  const currentDefaultClubs = rankingGender === Gender.MALE ? defaultClubsMale : defaultClubsFemale;

  // Estadillo Settings
  const [estadilloConfig, setEstadilloConfig] = useState({
    athletesPerEvent: 1,
    maxEventsPerAthlete: 1,
    maxAssociatedAthletes: 5,
    mainTeam: "RCVPO",
    gender: Gender.MALE,
    u23OnlyForFilials: false
  });
  const [excludedEvents, setExcludedEvents] = useState<string[]>(["4X100M", "4X400M"]);
  const [optimizedEstadillo, setOptimizedEstadillo] = useState<any[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appendInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadInitialData = async () => {
      // Small delay to ensure server is ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setIsLoading(true);
      try {
        console.log("Cargando archivos iniciales...");
        // Fetch the list of CSV files from the server
        let initialFiles: string[] = [];
        try {
          const filesResponse = await fetch("/api/csv-files");
          if (filesResponse.ok) {
            initialFiles = await filesResponse.json();
          } else {
            console.warn("API de archivos no disponible, usando fallback");
            initialFiles = ["ranking_1.csv", "ranking_2.csv", "ranking_3.csv", "ranking_4.csv"];
          }
        } catch (e) {
          console.warn("Error al conectar con la API, usando fallback:", e);
          initialFiles = ["ranking_1.csv", "ranking_2.csv", "ranking_3.csv", "ranking_4.csv"];
        }
        
        console.log("Archivos a cargar:", initialFiles);
        let combinedData: RankingData | null = null;
        const baseUrl = window.location.origin;

        for (const fileName of initialFiles) {
          try {
            console.log(`Cargando: ${fileName}`);
            const response = await fetch(`${baseUrl}/${fileName}?v=${Date.now()}`);
            if (response.ok) {
              const csvText = await response.text();
              if (csvText && csvText.trim().length > 0) {
                const newData = parseRankingCSV(csvText);
                if (newData.sections.length > 0) {
                  if (!combinedData) {
                    combinedData = newData;
                  } else {
                    combinedData = mergeRankingData(combinedData, newData);
                  }
                }
              }
            } else {
              console.warn(`No se pudo cargar ${fileName}: ${response.statusText}`);
            }
          } catch (e) {
            console.warn(`Error al cargar ${fileName}:`, e);
          }
        }

        if (combinedData && combinedData.sections.length > 0) {
          setRankingData(combinedData);
          
          if (combinedData.allEvents.length > 0) {
            setSelectedEvent(combinedData.allEvents[0]);
          }
          
          const availableDefaults = INITIAL_DEFAULT_CLUBS_MALE.filter(club => 
            combinedData!.allTeams.some(t => t.toUpperCase() === club.toUpperCase())
          );
          setSelectedTeams(availableDefaults);
        }
      } catch (err) {
        console.error("Error crítico cargando datos iniciales:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const processFiles = async (files: FileList) => {
    setIsLoading(true);
    setError(null);
    try {
      let combinedData: RankingData | null = null;
      
      for (let i = 0; i < files.length; i++) {
        const newData = await parseRankingFile(files[i]);
        if (!combinedData) {
          combinedData = newData;
        } else {
          combinedData = mergeRankingData(combinedData, newData);
        }
      }

      if (combinedData) {
        setRankingData(combinedData);
        // Always set the first event of the new data as selected
        if (combinedData.allEvents.length > 0) {
          setSelectedEvent(combinedData.allEvents[0]);
        }
        
        // Reset selected teams to defaults for the current gender
        const newDefaults = rankingGender === Gender.MALE ? defaultClubsMale : defaultClubsFemale;
        const availableDefaults = newDefaults.filter(club => 
          combinedData!.allTeams.some(t => t.toUpperCase() === club.toUpperCase())
        );
        setSelectedTeams(availableDefaults);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar el archivo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEstadilloGenderChange = (gender: Gender) => {
    const mainTeam = gender === Gender.MALE ? "RCVPO" : "CAFPO";
    setEstadilloConfig(prev => ({ ...prev, gender, mainTeam }));
    
    // Update selected teams to match the gender defaults
    const newDefaults = gender === Gender.MALE ? defaultClubsMale : defaultClubsFemale;
    if (rankingData) {
      const availableDefaults = newDefaults.filter(club => 
        rankingData.allTeams.some(t => t.toUpperCase() === club.toUpperCase())
      );
      setSelectedTeams(availableDefaults);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
  };

  const handleAppendFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !rankingData) return;
    
    setIsLoading(true);
    setError(null);
    try {
      let currentData = rankingData;
      for (let i = 0; i < files.length; i++) {
        const newData = await parseRankingFile(files[i]);
        currentData = mergeRankingData(currentData, newData);
      }
      setRankingData(currentData);
      
      // Apply default clubs for newly discovered teams
      const availableDefaults = currentDefaultClubs.filter(club => 
        currentData.allTeams.some(t => t.toUpperCase() === club.toUpperCase())
      );
      setSelectedTeams(prev => [...new Set([...prev, ...availableDefaults])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al añadir el ranking");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSections = useMemo(() => {
    if (!rankingData) return [];
    
    // Filter by gender first
    const genderFilteredSections = rankingData.sections.filter(section => {
      const eventGender = getGenderFromEventName(section.eventName);
      return !eventGender || eventGender === rankingGender;
    });

    const processEntries = (entries: RankingEntry[]) => {
      let result = selectedTeams.length > 0 
        ? entries.filter(entry => selectedTeams.includes(entry.team))
        : entries;

      if (rankingU23OnlyForFilials) {
        result = result.filter(entry => {
          const entryTeamUpper = entry.team?.toUpperCase().trim() || "";
          const mainTeamUpper = rankingMainTeam.toUpperCase().trim();
          const isMainTeam = entryTeamUpper === mainTeamUpper;
          
          if (isMainTeam) return true;
          return isU23OrYounger(entry.year);
        });
      }

      if (topLimit !== null) {
        result = result.slice(0, topLimit);
      }

      return result;
    };

    if (selectedEvent === "ALL_EVENTS") {
      return genderFilteredSections.map(section => {
        const entries = processEntries(section.entries);
        return { ...section, entries };
      }).filter(section => section.entries.length > 0);
    } else {
      const section = genderFilteredSections.find(s => s.eventName === selectedEvent);
      if (!section) return [];
      
      const entries = processEntries(section.entries);
      return entries.length > 0 ? [{ ...section, entries }] : [];
    }
  }, [rankingData, selectedEvent, selectedTeams, topLimit, rankingGender, rankingU23OnlyForFilials, rankingMainTeam]);

  const totalFilteredEntriesCount = useMemo(() => {
    return filteredSections.reduce((acc, section) => acc + section.entries.length, 0);
  }, [filteredSections]);

  const rankingEvents = useMemo(() => {
    if (!rankingData) return [];
    return rankingData.allEvents.filter(event => {
      const eventGender = getGenderFromEventName(event);
      return !eventGender || eventGender === rankingGender;
    });
  }, [rankingData, rankingGender]);

  const filteredTeams = useMemo(() => {
    if (!rankingData) return [];
    
    // Filter teams that have at least one entry in the current gender
    const teamsInGender = new Set<string>();
    rankingData.sections.forEach(section => {
      const eventGender = getGenderFromEventName(section.eventName);
      if (!eventGender || eventGender === rankingGender) {
        section.entries.forEach(entry => teamsInGender.add(entry.team));
      }
    });

    return Array.from(teamsInGender)
      .filter(team => team.toLowerCase().includes(teamSearch.toLowerCase()))
      .sort((a, b) => a.localeCompare(b));
  }, [rankingData, teamSearch, rankingGender]);

  const toggleTeam = (team: string) => {
    setSelectedTeams(prev => 
      prev.includes(team) 
        ? prev.filter(t => t !== team) 
        : [...prev, team]
    );
  };

  const saveDefaultClubs = (clubs: string[], gender: Gender) => {
    if (gender === Gender.MALE) {
      setDefaultClubsMale(clubs);
      localStorage.setItem(DEFAULT_CLUBS_MALE_KEY, JSON.stringify(clubs));
    } else {
      setDefaultClubsFemale(clubs);
      localStorage.setItem(DEFAULT_CLUBS_FEMALE_KEY, JSON.stringify(clubs));
    }
  };

  const handleExportExcel = () => {
    if (view === "RANKING") {
      if (filteredSections.length === 0) return;
      const wb = XLSX.utils.book_new();
      const data: any[] = [];
      filteredSections.forEach((section) => {
        data.push([section.eventName.toUpperCase()]);
        data.push(["#", "Marca", "Vv", "Pto.", "Atleta", "Ano", "Equipo", "Data", "Lugar"]);
        section.entries.forEach((entry) => {
          data.push([entry.rank, entry.mark, entry.wind, entry.position, entry.athlete, entry.year, entry.team, entry.date, entry.location]);
        });
        data.push([]);
      });
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Ranking");
      const fileName = selectedEvent === "ALL_EVENTS" ? "Ranking_Galego_Completo.xlsx" : `Ranking_${selectedEvent.replace(/\s+/g, "_")}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } else {
      if (optimizedEstadillo.length === 0) return;
      const wb = XLSX.utils.book_new();
      const data: any[] = [
        [`ESTADILLO OPTIMIZADO - ${estadilloConfig.mainTeam}`],
        ["Puntuación Total:", optimizedEstadillo.reduce((acc, curr) => acc + curr.points, 0)],
        [],
        ["Prueba", "Atleta", "Marca", "Puntos IAAF", "Equipo"]
      ];
      optimizedEstadillo.forEach(item => {
        data.push([item.event, item.athlete, item.mark, item.points, item.team]);
      });
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Estadillo");
      XLSX.writeFile(wb, "Estadillo_Optimizado.xlsx");
    }
  };

  const generateEstadillo = () => {
    if (!rankingData) return;

    // 1. Get all possible athlete-event combinations for absolute events
    const candidates: any[] = [];
    rankingData.sections.forEach(section => {
      if (isEstadilloEvent(section.eventName, estadilloConfig.gender)) {
        const canonical = getCanonicalEventName(section.eventName);
        if (excludedEvents.includes(canonical)) return;

        section.entries.forEach(entry => {
          const entryTeamUpper = entry.team?.toUpperCase().trim() || "";
          const mainTeamUpper = estadilloConfig.mainTeam.toUpperCase().trim();
          
          const isMainTeam = entryTeamUpper === mainTeamUpper;
          const isInSelected = selectedTeams.some(t => t.toUpperCase().trim() === entryTeamUpper);
          
          // An athlete is valid if they are from the main team 
          // OR if they are from one of the selected teams.
          // If no teams are selected, we ONLY consider the main team (no filiales).
          let isValid = selectedTeams.length > 0 ? (isMainTeam || isInSelected) : isMainTeam;
          
          // New Filter: If it's a filial (not main team) and the filter is active,
          // only allow U23 and younger (born in U23_BIRTH_YEAR or later)
          if (isValid && !isMainTeam && estadilloConfig.u23OnlyForFilials) {
            if (!isU23OrYounger(entry.year)) {
              isValid = false;
            }
          }
          
          if (!isValid) return;
          
          const points = calculateIAAFPoints(section.eventName, entry.mark, estadilloConfig.gender);
          if (points > 0) {
            candidates.push({
              event: section.eventName,
              canonicalEvent: getCanonicalEventName(section.eventName),
              athlete: entry.athlete,
              mark: entry.mark,
              points,
              team: entry.team,
              isAssociated: !isMainTeam
            });
          }
        });
      }
    });

    // 2. Sort by points descending
    candidates.sort((a, b) => b.points - a.points);

    // 3. Greedy selection with constraints
    const selected: any[] = [];
    const athleteCountMap = new Map<string, number>();
    const eventCountMap = new Map<string, number>();
    let associatedCount = 0;

    for (const cand of candidates) {
      const athleteCount = athleteCountMap.get(cand.athlete) || 0;
      const eventCount = eventCountMap.get(cand.canonicalEvent) || 0;

      if (athleteCount < estadilloConfig.maxEventsPerAthlete && 
          eventCount < estadilloConfig.athletesPerEvent) {
        
        if (cand.isAssociated && associatedCount >= estadilloConfig.maxAssociatedAthletes) {
          continue;
        }

        selected.push(cand);
        athleteCountMap.set(cand.athlete, athleteCount + 1);
        eventCountMap.set(cand.canonicalEvent, eventCount + 1);
        if (cand.isAssociated) associatedCount++;
      }
    }

    setOptimizedEstadillo(selected.sort((a, b) => a.event.localeCompare(b.event)));
  };

  const resetData = () => {
    setRankingData(null);
    setSelectedEvent("");
    setSelectedTeams([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="bg-[#141414] p-2 rounded-lg">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">Ranking Galego</h1>
            </div>

            {rankingData && (
              <nav className="flex bg-[#F3F4F6] p-1 rounded-xl">
                <button 
                  onClick={() => setView("RANKING")}
                  className={cn(
                    "px-4 py-1.5 text-sm font-semibold rounded-lg transition-all",
                    view === "RANKING" ? "bg-white text-[#141414] shadow-sm" : "text-[#6B7280] hover:text-[#111827]"
                  )}
                >
                  Ranking
                </button>
                <button 
                  onClick={() => setView("ESTADILLO")}
                  className={cn(
                    "px-4 py-1.5 text-sm font-semibold rounded-lg transition-all",
                    view === "ESTADILLO" ? "bg-white text-[#141414] shadow-sm" : "text-[#6B7280] hover:text-[#111827]"
                  )}
                >
                  Estadillos
                </button>
              </nav>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {rankingData && (
              <div className="flex items-center gap-2">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv,.xls,.xlsx"
                  multiple
                  className="hidden"
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="text-sm font-semibold text-[#141414] hover:bg-gray-100 flex items-center gap-2 transition-colors border border-[#E5E7EB] px-3 py-1.5 rounded-lg"
                  title="Reemplazar todo el ranking actual"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Cargar Nuevo
                </button>

                <input 
                  type="file" 
                  ref={appendInputRef}
                  onChange={handleAppendFile}
                  accept=".csv,.xls,.xlsx"
                  multiple
                  className="hidden"
                />
                <button 
                  onClick={() => appendInputRef.current?.click()}
                  disabled={isLoading}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-2 transition-colors bg-blue-50 px-3 py-1.5 rounded-lg"
                  title="Añadir datos al ranking actual"
                >
                  <Upload className="w-4 h-4" />
                  Añadir
                </button>
              </div>
            )}
            <button 
              onClick={() => {
                setTempClubsMale(defaultClubsMale.join("\n"));
                setTempClubsFemale(defaultClubsFemale.join("\n"));
                setShowSettings(true);
              }}
              className="text-sm font-medium text-[#6B7280] hover:text-[#111827] flex items-center gap-2 transition-colors"
            >
              <Filter className="w-4 h-4" />
              Configurar Clubes
            </button>
            {rankingData && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleExportExcel}
                  className="bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Excel
                </button>
                <button 
                  onClick={resetData}
                  className="text-sm font-medium text-[#6B7280] hover:text-[#111827] flex items-center gap-2 transition-colors px-2"
                >
                  <X className="w-4 h-4" />
                  Limpiar
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Clubes por Defecto</h3>
                <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <p className="text-sm text-[#6B7280] mb-4">
                Introduce los códigos de los clubes que quieres que se seleccionen automáticamente al cargar un ranking (uno por línea).
              </p>
              
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-2">Masculino</h4>
                  <textarea 
                    className="w-full h-32 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#141414]/10"
                    value={tempClubsMale}
                    onChange={(e) => setTempClubsMale(e.target.value)}
                    placeholder="RCVPO&#10;STOC&#10;..."
                  />
                </div>
                
                <div>
                  <h4 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-2">Femenino</h4>
                  <textarea 
                    className="w-full h-32 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#141414]/10"
                    value={tempClubsFemale}
                    onChange={(e) => setTempClubsFemale(e.target.value)}
                    placeholder="CAFPO&#10;PUROR&#10;..."
                  />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button 
                  onClick={() => {
                    const maleClubs = tempClubsMale.split("\n").map(s => s.trim()).filter(Boolean);
                    const femaleClubs = tempClubsFemale.split("\n").map(s => s.trim()).filter(Boolean);
                    saveDefaultClubs(maleClubs, Gender.MALE);
                    saveDefaultClubs(femaleClubs, Gender.FEMALE);
                    setShowSettings(false);
                  }}
                  className="bg-[#141414] text-white px-6 py-2 rounded-xl font-semibold hover:bg-[#2D2D2D] transition-all"
                >
                  Guardar y Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {!rankingData ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto"
          >
            <div className="bg-white border-2 border-dashed border-[#D1D5DB] rounded-2xl p-12 text-center">
              <div className="bg-[#F3F4F6] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Upload className="w-8 h-8 text-[#4B5563]" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Cargar Ranking</h2>
              <p className="text-[#6B7280] mb-8">
                Sube un archivo CSV o XLS con el ranking de atletismo para empezar a filtrar.
              </p>
              
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv,.xls,.xlsx"
                multiple
                className="hidden"
              />
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="bg-[#141414] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#2D2D2D] transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                ) : (
                  <FileSpreadsheet className="w-5 h-5" />
                )}
                {isLoading ? "Procesando..." : "Seleccionar Archivo(s)"}
              </button>
              <p className="mt-4 text-[10px] text-[#9CA3AF] uppercase tracking-widest font-bold">
                Puedes seleccionar varios archivos a la vez
              </p>

              {error && (
                <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <>
            {view === "RANKING" && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar Filters */}
            <aside className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm">
                <div className="flex items-center gap-2 mb-4 text-[#111827] font-semibold">
                  <Filter className="w-4 h-4" />
                  <h3>Filtros</h3>
                </div>

                <div className="space-y-6">
                  {/* Gender Filter */}
                  <div>
                    <label className="block text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-2">
                      Categoría
                    </label>
                    <div className="flex bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-1">
                      {[
                        { label: "Masculino", value: Gender.MALE },
                        { label: "Femenino", value: Gender.FEMALE },
                      ].map((option) => (
                        <button
                          key={option.label}
                          onClick={() => {
                            setRankingGender(option.value);
                            setSelectedEvent("ALL_EVENTS");
                            setRankingMainTeam(option.value === Gender.MALE ? "RCVPO" : "CAFPO");
                            
                            // Auto-select defaults for the new gender
                            const newDefaults = option.value === Gender.MALE ? defaultClubsMale : defaultClubsFemale;
                            const availableDefaults = newDefaults.filter(club => 
                              rankingData.allTeams.some(t => t.toUpperCase() === club.toUpperCase())
                            );
                            setSelectedTeams(availableDefaults);
                          }}
                          className={cn(
                            "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all",
                            rankingGender === option.value
                              ? "bg-white text-[#141414] shadow-sm"
                              : "text-[#9CA3AF] hover:text-[#4B5563]"
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Event Filter */}
                  <div>
                    <label className="block text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-2">
                      Prueba
                    </label>
                    <div className="relative">
                      <select 
                        value={selectedEvent}
                        onChange={(e) => setSelectedEvent(e.target.value)}
                        className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-4 py-2.5 appearance-none focus:outline-none focus:ring-2 focus:ring-[#141414]/10 transition-all text-sm"
                      >
                        <option value="ALL_EVENTS">--- TODAS LAS PRUEBAS ---</option>
                        {rankingEvents.map(event => (
                          <option key={event} value={event}>{event}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
                    </div>
                  </div>

                  {/* Top Limit Filter */}
                  <div>
                    <label className="block text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-2">
                      Ranking
                    </label>
                    <div className="flex bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-1">
                      {[
                        { label: "Top 10", value: 10 },
                        { label: "Top 20", value: 20 },
                        { label: "Top 50", value: 50 },
                        { label: "Todos", value: null },
                      ].map((option) => (
                        <button
                          key={option.label}
                          onClick={() => setTopLimit(option.value)}
                          className={cn(
                            "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all",
                            topLimit === option.value
                              ? "bg-white text-[#141414] shadow-sm"
                              : "text-[#9CA3AF] hover:text-[#4B5563]"
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* U23 Filial Filter */}
                  <div className="space-y-4 pt-2 border-t border-[#F3F4F6]">
                    <div>
                      <label className="block text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-2">
                        Club Principal
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                        <input 
                          type="text"
                          value={rankingMainTeam}
                          onChange={(e) => setRankingMainTeam(e.target.value.toUpperCase())}
                          placeholder="Ej: RCVPO"
                          className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#141414]/10 transition-all"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input 
                          type="checkbox"
                          checked={rankingU23OnlyForFilials}
                          onChange={(e) => setRankingU23OnlyForFilials(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-black/5 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
                      </div>
                      <span className="text-xs font-bold text-[#6B7280] uppercase">Filiales solo U23 y menores</span>
                    </label>
                    <p className="text-[10px] text-[#9CA3AF] mt-1 italic">
                      Solo atletas nacidos en {U23_BIRTH_YEAR} o posteriores para clubes filiales
                    </p>
                  </div>

                  {/* Team Filter */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-[#6B7280] uppercase tracking-wider">
                        Clubes
                      </label>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            const availableDefaults = currentDefaultClubs.filter(club => 
                              rankingData.allTeams.some(t => t.toUpperCase() === club.toUpperCase())
                            );
                            setSelectedTeams(availableDefaults);
                          }}
                          className="text-[10px] font-bold text-blue-600 uppercase tracking-wider hover:underline"
                        >
                          Defaults
                        </button>
                        {selectedTeams.length > 0 && (
                          <button 
                            onClick={() => setSelectedTeams([])}
                            className="text-[10px] font-bold text-[#EF4444] uppercase tracking-wider hover:underline"
                          >
                            Limpiar
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                      <input 
                        type="text"
                        placeholder="Buscar club..."
                        value={teamSearch}
                        onChange={(e) => setTeamSearch(e.target.value)}
                        className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#141414]/10 transition-all"
                      />
                    </div>

                    <div className="max-h-[400px] overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                      {filteredTeams.map(team => (
                        <button
                          key={team}
                          onClick={() => toggleTeam(team)}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between group",
                            selectedTeams.includes(team) 
                              ? "bg-[#141414] text-white" 
                              : "hover:bg-[#F3F4F6] text-[#4B5563]"
                          )}
                        >
                          <span className="truncate">{team || "Sin equipo"}</span>
                          {selectedTeams.includes(team) && <Check className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                      {filteredTeams.length === 0 && (
                        <p className="text-xs text-[#9CA3AF] text-center py-4 italic">No se encontraron clubes</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            {/* Main Content */}
            <div className="lg:col-span-3 space-y-6">
              {/* Stats Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-sm flex items-center gap-4">
                  <div className="bg-blue-50 p-2.5 rounded-xl">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#6B7280]">Atletas</p>
                    <p className="text-xl font-bold">{totalFilteredEntriesCount}</p>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-sm flex items-center gap-4">
                  <div className="bg-emerald-50 p-2.5 rounded-xl">
                    <Trophy className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#6B7280]">Prueba</p>
                    <p className="text-sm font-bold truncate max-w-[150px]">
                      {selectedEvent === "ALL_EVENTS" ? "Todas las pruebas" : selectedEvent}
                    </p>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-sm flex items-center gap-4">
                  <div className="bg-amber-50 p-2.5 rounded-xl">
                    <Calendar className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[#6B7280]">Clubes Seleccionados</p>
                    <p className="text-sm font-bold truncate" title={selectedTeams.length > 0 ? selectedTeams.join(", ") : "Todos"}>
                      {selectedTeams.length > 0 ? selectedTeams.join(", ") : "Todos los clubes"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tables */}
              <div className="space-y-8">
                {filteredSections.map((section) => (
                  <div key={section.eventName} className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      <Trophy className="w-4 h-4 text-[#141414]" />
                      <h3 className="text-sm font-bold uppercase tracking-tight text-[#141414]">
                        {section.eventName}
                      </h3>
                      <span className="text-[10px] font-bold bg-[#F3F4F6] text-[#6B7280] px-2 py-0.5 rounded-full">
                        {section.entries.length} atletas
                      </span>
                    </div>
                    
                    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">#</th>
                                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Marca</th>
                                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Puntos IAAF</th>
                                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Vv</th>
                                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Atleta</th>
                                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Ano</th>
                                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Equipo</th>
                                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Data</th>
                                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Lugar</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#F3F4F6]">
                                <AnimatePresence mode="popLayout">
                                  {section.entries.map((entry, idx) => {
                                    const gender = section.eventName.toUpperCase().includes("FEM") || section.eventName.toUpperCase().includes("MULLER") ? Gender.FEMALE : Gender.MALE;
                                    const points = calculateIAAFPoints(section.eventName, entry.mark, gender);
                                    
                                    return (
                                      <motion.tr 
                                        layout
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        key={`${section.eventName}-${entry.athlete}-${entry.mark}-${idx}`}
                                        className="hover:bg-[#F9FAFB] transition-colors group"
                                      >
                                        <td className="px-6 py-4 text-sm font-mono text-[#9CA3AF]">{entry.rank}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-[#111827]">{entry.mark}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-blue-600">{points || "-"}</td>
                                        <td className="px-6 py-4 text-sm text-[#6B7280]">{entry.wind || "-"}</td>
                                        <td className="px-6 py-4">
                                          <div className="text-sm font-semibold text-[#111827]">{entry.athlete}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-[#6B7280]">{entry.year}</td>
                                        <td className="px-6 py-4">
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                            {entry.team || "Independiente"}
                                          </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-[#6B7280] whitespace-nowrap">
                                          <div className="flex items-center gap-2">
                                            <Calendar className="w-3.5 h-3.5 opacity-50" />
                                            {entry.date}
                                          </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-[#6B7280]">
                                          <div className="flex items-center gap-2">
                                            <MapPin className="w-3.5 h-3.5 opacity-50" />
                                            {entry.location}
                                          </div>
                                        </td>
                                      </motion.tr>
                                    );
                                  })}
                                </AnimatePresence>
                              </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))}

                {filteredSections.length === 0 && (
                  <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm py-20 text-center">
                    <div className="bg-[#F3F4F6] w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="w-6 h-6 text-[#9CA3AF]" />
                    </div>
                    <h3 className="text-lg font-semibold text-[#111827]">No se encontraron resultados</h3>
                    <p className="text-[#6B7280]">Prueba a cambiar los filtros o selecciona otros clubes.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

            {view === "ESTADILLO" && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Estadillo Sidebar */}
                <aside className="lg:col-span-1 space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm">
                    <h3 className="font-bold mb-4 flex items-center gap-2">
                      <Filter className="w-4 h-4" />
                      Configuración
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-[#6B7280] uppercase mb-2">Categoría</label>
                        <div className="flex bg-[#F3F4F6] p-1 rounded-xl">
                          <button 
                            onClick={() => handleEstadilloGenderChange(Gender.MALE)}
                            className={cn(
                              "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
                              estadilloConfig.gender === Gender.MALE ? "bg-white text-[#141414] shadow-sm" : "text-[#6B7280] hover:text-[#111827]"
                            )}
                          >
                            Masculino
                          </button>
                          <button 
                            onClick={() => handleEstadilloGenderChange(Gender.FEMALE)}
                            className={cn(
                              "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
                              estadilloConfig.gender === Gender.FEMALE ? "bg-white text-[#141414] shadow-sm" : "text-[#6B7280] hover:text-[#111827]"
                            )}
                          >
                            Femenino
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#6B7280] uppercase mb-2">Club Principal</label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                          <input 
                            type="text"
                            value={estadilloConfig.mainTeam}
                            onChange={(e) => setEstadilloConfig({...estadilloConfig, mainTeam: e.target.value.toUpperCase()})}
                            placeholder="Ej: CAFPO"
                            className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-black/5"
                          />
                        </div>
                        <p className="text-[10px] text-[#9CA3AF] mt-1 italic">
                          Define quién NO es filial
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#6B7280] uppercase mb-2">Atletas por prueba</label>
                        <select 
                          value={estadilloConfig.athletesPerEvent}
                          onChange={(e) => setEstadilloConfig({...estadilloConfig, athletesPerEvent: parseInt(e.target.value)})}
                          className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-4 py-2 text-sm"
                        >
                          <option value={1}>El mejor (1)</option>
                          <option value={2}>Los dos mejores (2)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#6B7280] uppercase mb-2">Pruebas por atleta</label>
                        <select 
                          value={estadilloConfig.maxEventsPerAthlete}
                          onChange={(e) => setEstadilloConfig({...estadilloConfig, maxEventsPerAthlete: parseInt(e.target.value)})}
                          className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-4 py-2 text-sm"
                        >
                          <option value={1}>Máximo 1 prueba</option>
                          <option value={2}>Máximo 2 pruebas</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#6B7280] uppercase mb-2">Límite de filiales</label>
                        <input 
                          type="number"
                          value={estadilloConfig.maxAssociatedAthletes}
                          onChange={(e) => setEstadilloConfig({...estadilloConfig, maxAssociatedAthletes: parseInt(e.target.value)})}
                          className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-4 py-2 text-sm"
                        />
                        <p className="text-[10px] text-[#9CA3AF] mt-1 italic">
                          Atletas que no son del {estadilloConfig.mainTeam}
                        </p>
                      </div>

                      <div className="pt-2">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <div className="relative flex items-center">
                            <input 
                              type="checkbox"
                              checked={estadilloConfig.u23OnlyForFilials}
                              onChange={(e) => setEstadilloConfig({...estadilloConfig, u23OnlyForFilials: e.target.checked})}
                              className="sr-only peer"
                            />
                            <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-black/5 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
                          </div>
                          <span className="text-xs font-bold text-[#6B7280] uppercase">Filiales solo U23 y menores</span>
                        </label>
                        <p className="text-[10px] text-[#9CA3AF] mt-1 italic">
                          Solo atletas nacidos en {U23_BIRTH_YEAR} o posteriores para clubes filiales
                        </p>
                      </div>

                      <div className="pt-2">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-bold text-[#6B7280] uppercase">Pruebas Incluidas</label>
                          <button 
                            onClick={() => {
                              const allCanonical = (estadilloConfig.gender === Gender.MALE ? MALE_ESTADILLO_EVENTS : FEMALE_ESTADILLO_EVENTS).map(e => getCanonicalEventName(e));
                              const currentGenderCanonical = (estadilloConfig.gender === Gender.MALE ? MALE_ESTADILLO_EVENTS : FEMALE_ESTADILLO_EVENTS).map(e => getCanonicalEventName(e));
                              const genderExcluded = excludedEvents.filter(e => currentGenderCanonical.includes(e));
                              
                              if (genderExcluded.length < currentGenderCanonical.length) {
                                // Exclude all for this gender
                                setExcludedEvents(prev => [...new Set([...prev, ...currentGenderCanonical])]);
                              } else {
                                // Include all for this gender
                                setExcludedEvents(prev => prev.filter(e => !currentGenderCanonical.includes(e)));
                              }
                            }}
                            className="text-[10px] font-bold text-blue-600 hover:text-blue-700"
                          >
                            {excludedEvents.filter(e => (estadilloConfig.gender === Gender.MALE ? MALE_ESTADILLO_EVENTS : FEMALE_ESTADILLO_EVENTS).map(ge => getCanonicalEventName(ge)).includes(e)).length === (estadilloConfig.gender === Gender.MALE ? MALE_ESTADILLO_EVENTS.length : FEMALE_ESTADILLO_EVENTS.length) ? "Todas" : "Ninguna"}
                          </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto border border-[#E5E7EB] rounded-xl p-2 space-y-1 bg-[#F9FAFB]">
                          {(estadilloConfig.gender === Gender.MALE ? MALE_ESTADILLO_EVENTS : FEMALE_ESTADILLO_EVENTS).map(event => {
                            const canonical = getCanonicalEventName(event);
                            const isExcluded = excludedEvents.includes(canonical);
                            return (
                              <label key={event} className="flex items-center gap-2 px-2 py-1 hover:bg-white rounded-lg cursor-pointer transition-colors">
                                <input 
                                  type="checkbox" 
                                  checked={!isExcluded}
                                  onChange={() => {
                                    if (isExcluded) {
                                      setExcludedEvents(prev => prev.filter(e => e !== canonical));
                                    } else {
                                      setExcludedEvents(prev => [...prev, canonical]);
                                    }
                                  }}
                                  className="rounded border-[#D1D5DB] text-[#141414] focus:ring-[#141414]"
                                />
                                <span className="text-xs font-medium text-[#374151]">{event}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <button 
                        onClick={generateEstadillo}
                        className="w-full bg-[#141414] text-white py-3 rounded-xl font-bold hover:bg-[#2D2D2D] transition-all shadow-lg shadow-black/5"
                      >
                        Generar Estadillo
                      </button>
                    </div>
                  </div>

                  <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                    <h4 className="text-blue-800 font-bold text-sm mb-2">Instrucciones</h4>
                    <p className="text-blue-700 text-xs leading-relaxed">
                      El sistema seleccionará automáticamente a los atletas que sumen más puntos IAAF respetando los límites de filiales y pruebas por atleta.
                    </p>
                  </div>
                </aside>

                {/* Estadillo Content */}
                <div className="lg:col-span-3 space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Puntuación Total</p>
                      <p className="text-4xl font-black text-[#141414]">
                        {optimizedEstadillo.reduce((acc, curr) => acc + curr.points, 0).toLocaleString()} <span className="text-sm font-medium text-[#9CA3AF]">puntos</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Pruebas Cubiertas</p>
                      <p className="text-xl font-bold">
                        {optimizedEstadillo.length} / {((estadilloConfig.gender === Gender.MALE ? MALE_ESTADILLO_EVENTS.length : FEMALE_ESTADILLO_EVENTS.length) - 
                          excludedEvents.filter(e => (estadilloConfig.gender === Gender.MALE ? MALE_ESTADILLO_EVENTS : FEMALE_ESTADILLO_EVENTS).some(ae => getCanonicalEventName(ae) === e)).length) * estadilloConfig.athletesPerEvent}
                      </p>
                    </div>
                  </div>

                  {optimizedEstadillo.length > 0 ? (
                    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                            <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase">Prueba</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase">Atleta</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase">Marca</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase text-right">Puntos IAAF</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase">Equipo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F3F4F6]">
                          {optimizedEstadillo.map((item, idx) => (
                            <tr key={idx} className="hover:bg-[#F9FAFB] transition-colors">
                              <td className="px-6 py-4 text-sm font-bold text-[#141414]">{item.event}</td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-[#4B5563]">{item.athlete}</span>
                                  {item.isAssociated && (
                                    <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-100">
                                      FILIAL
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm font-mono">{item.mark}</td>
                              <td className="px-6 py-4 text-sm font-black text-emerald-600 text-right">{item.points}</td>
                              <td className="px-6 py-4">
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                  item.isAssociated ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
                                )}>
                                  {item.team}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm py-20 text-center">
                      <div className="bg-[#F3F4F6] w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Trophy className="w-6 h-6 text-[#9CA3AF]" />
                      </div>
                      <h3 className="text-lg font-semibold text-[#111827]">Estadillo no generado</h3>
                      <p className="text-[#6B7280]">Configura los parámetros y haz clic en "Generar Estadillo".</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
