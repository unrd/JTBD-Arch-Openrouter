
export enum JobLevel {
  SUPER_BIG = 'СУПЕР БОЛЬШАЯ РАБОТА',
  BIG = 'БОЛЬШАЯ РАБОТА',
  SMALL = 'МАЛАЯ РАБОТА',
  CORE = 'ОСНОВНАЯ РАБОТА',
  MICRO = 'МИКРО РАБОТА'
}

export interface JTBDNode {
  id: string;
  name: string;
  type: JobLevel;
  description?: string;
  annotation?: string; // New field for the "Why?" explanation
  children?: JTBDNode[];
}

export type AnalysisMode = 'simple' | 'detailed';

export interface GenerationParams {
  mode: AnalysisMode;
  problem: string;
  persona?: string;
  uniqueTrait?: string;
  segmentContext?: string;
}

export interface AppState {
  isLoading: boolean;
  error: string | null;
  graph: JTBDNode | null;
  selectedNodeId: string | null;
}

export const JOB_EXAMPLES: Record<JobLevel, { label: string, example: string }> = {
  [JobLevel.SUPER_BIG]: {
    label: "Амбиции",
    example: "Чувствовать себя профессионально реализованным и уважаемым в своей области."
  },
  [JobLevel.BIG]: {
    label: "Стратегия",
    example: "Продвинуться по карьерной лестнице до позиции топ-менеджера."
  },
  [JobLevel.SMALL]: {
    label: "Тактика",
    example: "Освоить передовые паттерны проектирования систем."
  },
  [JobLevel.CORE]: {
    label: "Функция",
    example: "Спроектировать и развернуть масштабируемую распределенную систему."
  },
  [JobLevel.MICRO]: {
    label: "Взаимодействие",
    example: "Настроить параметры балансировщика нагрузки для нового кластера."
  }
};
