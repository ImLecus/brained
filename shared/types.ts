export type Language = "es" | "en";

export type Theme = "light" | "dark";

export interface AppConfig {
  model: string;
  language: Language;
  theme: Theme;
}

export interface BrainInfo {
  name: string;
  path: string;
}

export interface BrainStatus {
  loaded: boolean;
  name?: string;
  path?: string;
}

export interface GraphNode {
  id: string;
  title: string;
  path: string;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
}