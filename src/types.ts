
export interface RankingEntry {
  rank: string;
  mark: string;
  wind: string;
  position: string;
  athlete: string;
  year: string;
  team: string;
  date: string;
  location: string;
}

export interface RankingSection {
  eventName: string;
  entries: RankingEntry[];
}

export interface RankingData {
  sections: RankingSection[];
  allTeams: string[];
  allEvents: string[];
}
