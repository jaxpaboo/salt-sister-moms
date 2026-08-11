// Domain types for the Salty Ideas / Salt Sister Moms project.
//
// Three tables, each stored as a flat map at the root of Firebase Realtime
// Database: `projects`, `sponsors`, `inspirations`. Each entry's key is its id
// — for `projects`, that's a generated `YYYYMMDDnnn` value (see project-id.ts).

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export type ProjectStatus =
  | 'New'
  | 'Work in Process'
  | 'Active'
  | 'Archive'
  | 'Punt'
  | 'Pending Post'
  | 'Posted';

// Standard holidays / celebration occasions. Stored as a multi-value array on
// each project so a single idea can apply to several seasons at once.
export type SeasonOccasion =
  | 'New Year'
  | 'Valentine\'s Day'
  | 'Presidents Day'
  | 'St. Patrick\'s Day'
  | 'Easter'
  | 'Mother\'s Day'
  | 'Memorial Day'
  | 'Father\'s Day'
  | 'Independence Day'
  | 'Labor Day'
  | 'Halloween'
  | 'Thanksgiving'
  | 'Christmas'
  | 'Hanukkah'
  | 'Birthday'
  | 'Anniversary'
  | 'Wedding'
  | 'Baby Shower'
  | 'Bridal Shower'
  | 'Graduation'
  | 'Back to School'
  | 'Summer'
  | 'Fall'
  | 'Winter'
  | 'Spring'
  | 'Just Because';

export const SEASON_OPTIONS: SeasonOccasion[] = [
  'New Year',
  'Valentine\'s Day',
  'Presidents Day',
  'St. Patrick\'s Day',
  'Easter',
  'Mother\'s Day',
  'Memorial Day',
  'Father\'s Day',
  'Independence Day',
  'Labor Day',
  'Halloween',
  'Thanksgiving',
  'Christmas',
  'Hanukkah',
  'Birthday',
  'Anniversary',
  'Wedding',
  'Baby Shower',
  'Bridal Shower',
  'Graduation',
  'Back to School',
  'Summer',
  'Fall',
  'Winter',
  'Spring',
  'Just Because',
];

export const STATUS_OPTIONS: ProjectStatus[] = [
  'New',
  'Work in Process',
  'Active',
  'Archive',
  'Punt',
  'Pending Post',
  'Posted',
];

export const DIFFICULTY_OPTIONS: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

export const REPOSTABLE_OPTIONS = ['Yes', 'No', 'Maybe'] as const;
export type Repostable = typeof REPOSTABLE_OPTIONS[number];

export const INTEREST_LEVELS = [1, 2, 3, 4, 5] as const;
export type InterestLevel = typeof INTEREST_LEVELS[number];

// A single checklist row. Items are user-edited and reset per project — they
// intentionally don't share ids with anything in the sponsor or inspiration
// tables.
export interface ChecklistItem {
  text: string;
  done: boolean;
}

export interface Project {
  // YYYYMMDDnnn — generated when the project is created (see project-id.ts).
  project_id: string;
  idea_title: string;
  idea_description: string;
  // Multi-value: which seasons / occasions this idea fits.
  seasons: SeasonOccasion[];
  status: ProjectStatus;
  work_in_process: boolean;
  // Date-only strings (YYYY-MM-DD). Empty string when not set.
  post_date: string;
  due_date: string;
  // Free-text URL the user pastes (typically a Canva share link).
  canva_printable: string;
  difficulty: Difficulty | '';
  // Foreign keys into the sponsor / inspiration tables.
  sponsor_id: string;
  inspiration_id: string;
  // Stored as a comma-separated string so the form is a plain text input.
  // If you'd rather store as an array, change the form + this type together.
  materials: string;
  checklist: ChecklistItem[];
  repostable: Repostable;
  interest_level: InterestLevel | null;
  // ISO timestamp of last edit (used for sort / display).
  updated_at: string;
}
