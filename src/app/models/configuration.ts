// Configuration table — a flexible key/value store for app-level settings.
//
// Each record is a named configuration with a single fieldname/value pair.
// Multiple records can share a configuration_name (one per fieldname), so a
// single "configuration" can hold several related settings.
//
// Stored as a flat map at the root of Firebase Realtime Database under the
// `configurations` table, keyed by configuration_id.

export interface Configuration {
  // Auto-generated id (e.g. `conf_<timestamp>`).
  configuration_id: string;
  // Grouping name shown in the dropdown — e.g. "Email", "Social", "SEO".
  configuration_name: string;
  // The field key within that group — e.g. "smtp_host", "facebook_url".
  configuration_fieldname: string;
  // The field values — one entry per item. Treated as a list everywhere it's
  // rendered, edited, sorted, or persisted.
  configuration_values: string[];
  // ISO timestamp of last edit.
  updated_at: string;
}
