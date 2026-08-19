import { Injectable, inject, signal } from '@angular/core';

import { ChecklistItem, Project } from '../models/project';
import { Inspiration } from '../models/inspiration';
import { Sponsor } from '../models/sponsor';
import { Configuration } from '../models/configuration';
import { nextProjectId } from '../models/project-id';
import { DbService } from './db.service';

const TABLE = {
  projects: 'projects',
  sponsors: 'sponsors',
  inspirations: 'inspirations',
  configurations: 'configurations',
} as const;

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private db = inject(DbService);

  readonly projects = signal<Project[]>([]);
  readonly sponsors = signal<Sponsor[]>([]);
  readonly inspirations = signal<Inspiration[]>([]);
  readonly configurations = signal<Configuration[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string>('');

  // Guard so legacy `materials: string` records get migrated to
  // ChecklistItem[] at most once per session.
  private materialsMigrated = false;

  async refreshAll(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [projects, sponsors, inspirations, configurations] = await Promise.all([
        this.db.list<Project>(TABLE.projects),
        this.db.list<Sponsor>(TABLE.sponsors),
        this.db.list<Inspiration>(TABLE.inspirations),
        this.db.list<Configuration>(TABLE.configurations),
      ]);
      const migratedProjects = await this.migrateMaterials(projects);
      const normalizedProjects = migratedProjects.map((p) => ({
        ...p,
        seasons: p.seasons ?? [],
        materials: p.materials ?? [],
        checklist: p.checklist ?? [],
      }));
      this.projects.set(normalizedProjects);
      this.sponsors.set(sponsors);
      this.inspirations.set(this.normalizeInspirations(inspirations));
      this.configurations.set(this.normalizeConfigurations(configurations));
    } catch (e) {
      this.error.set(this.toMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Older projects stored `materials` as a comma-separated string. Convert
   * any legacy record into ChecklistItem[] in memory and write the new
   * shape back to RTDB so the editor sees consistent data on next load.
   * Idempotent and bounded to once per session.
   */
  private async migrateMaterials(projects: Project[]): Promise<Project[]> {
    if (this.materialsMigrated) return projects;
    this.materialsMigrated = true;

    const writes: Array<Promise<void>> = [];
    const normalized = projects.map((p) => {
      if (Array.isArray(p.materials)) return p;
      const converted: ChecklistItem[] = this.splitMaterials(p.materials as unknown as string);
      writes.push(
        this.db.update<Project>(TABLE.projects, p.project_id, { materials: converted }),
      );
      return { ...p, materials: converted };
    });
    if (writes.length) {
      await Promise.all(writes);
    }
    return normalized;
  }

  private splitMaterials(raw: string | null | undefined): ChecklistItem[] {
    if (!raw) return [];
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((text) => ({ text, done: false }));
  }

  /** Ensure inspiration fields default to empty strings when missing. */
  private normalizeInspirations(inspirations: Inspiration[]): Inspiration[] {
    return inspirations.map((i) => ({
      ...i,
      name: i.name ?? '',
      image_link: i.image_link ?? '',
      video_link: i.video_link ?? '',
      video_link_embedded: i.video_link_embedded ?? '',
      website_link: i.website_link ?? '',
      comments: i.comments ?? '',
      materials: i.materials ?? '',
    }));
  }

  /** Ensure configuration fields default to empty strings when missing. */
  private normalizeConfigurations(configurations: Configuration[]): Configuration[] {
    return configurations.map((c) => ({
      ...c,
      configuration_name: c.configuration_name ?? '',
      configuration_fieldname: c.configuration_fieldname ?? '',
      configuration_values: c.configuration_values ?? [],
    }));
  }

  async createProject(partial: Partial<Project> = {}): Promise<Project> {
    const id = nextProjectId(this.projects());
    const now = new Date().toISOString();
    // Defaults, then the caller's draft, then fields we always own
    // (project_id and updated_at) so they can't be overwritten.
    const draft: Omit<Project, 'project_id' | 'updated_at'> = {
      idea_title: '',
      idea_description: '',
      seasons: [],
      status: 'New',
      work_in_process: false,
      post_date: '',
      due_date: '',
      canva_printable: '',
      difficulty: '',
      sponsor_id: '',
      inspiration_id: '',
      materials: [],
      checklist: [],
      repostable: 'Maybe',
      interest_level: null,
      ...partial,
    };
    const project: Project = {
      ...draft,
      project_id: id,
      updated_at: now,
    };

    await this.db.create<Project>(TABLE.projects, id, project);
    this.projects.update((list) => [...list, project]);
    return project;
  }

  async updateProject(id: string, patch: Partial<Project>): Promise<void> {
    const updated = { ...patch, updated_at: new Date().toISOString() };
    await this.db.update<Project>(TABLE.projects, id, updated);
    this.projects.update((list) =>
      list.map((p) => (p.project_id === id ? { ...p, ...updated } : p)),
    );
  }

  async deleteProject(id: string): Promise<void> {
    // Soft delete: set project_deleted to true instead of removing.
    await this.db.update<Project>(TABLE.projects, id, {
      project_deleted: true,
      updated_at: new Date().toISOString(),
    });
    this.projects.update((list) =>
      list.map((p) =>
        p.project_id === id ? { ...p, project_deleted: true, updated_at: new Date().toISOString() } : p,
      ),
    );
  }

  async restoreProject(id: string): Promise<void> {
    await this.db.update<Project>(TABLE.projects, id, {
      project_deleted: false,
      updated_at: new Date().toISOString(),
    });
    this.projects.update((list) =>
      list.map((p) =>
        p.project_id === id ? { ...p, project_deleted: false, updated_at: new Date().toISOString() } : p,
      ),
    );
  }

  /** Return only non-deleted projects for the main dashboard. */
  activeProjects(): Project[] {
    return this.projects().filter((p) => !p.project_deleted);
  }

  /** Return only soft-deleted projects for the trash view. */
  trashedProjects(): Project[] {
    return this.projects().filter((p) => p.project_deleted);
  }

  async createSponsor(input: Omit<Sponsor, 'sponsor_id'>): Promise<Sponsor> {
    const id = `spon_${Date.now().toString(36)}`;
    const sponsor: Sponsor = { ...input, sponsor_id: id };
    await this.db.create<Sponsor>(TABLE.sponsors, id, sponsor);
    this.sponsors.update((list) => [...list, sponsor]);
    return sponsor;
  }

  async updateSponsor(id: string, patch: Partial<Sponsor>): Promise<void> {
    await this.db.update<Sponsor>(TABLE.sponsors, id, patch);
    this.sponsors.update((list) =>
      list.map((s) => (s.sponsor_id === id ? { ...s, ...patch } : s)),
    );
  }

  async deleteSponsor(id: string): Promise<void> {
    await this.db.remove(TABLE.sponsors, id);
    this.sponsors.update((list) => list.filter((s) => s.sponsor_id !== id));
  }

  async createInspiration(input: Omit<Inspiration, 'inspiration_id'>): Promise<Inspiration> {
    const id = `insp_${Date.now().toString(36)}`;
    const inspiration: Inspiration = { ...input, inspiration_id: id };
    await this.db.create<Inspiration>(TABLE.inspirations, id, inspiration);
    this.inspirations.update((list) => [...list, inspiration]);
    return inspiration;
  }

  async updateInspiration(id: string, patch: Partial<Inspiration>): Promise<void> {
    await this.db.update<Inspiration>(TABLE.inspirations, id, patch);
    this.inspirations.update((list) =>
      list.map((i) => (i.inspiration_id === id ? { ...i, ...patch } : i)),
    );
  }

  async deleteInspiration(id: string): Promise<void> {
    await this.db.remove(TABLE.inspirations, id);
    this.inspirations.update((list) => list.filter((i) => i.inspiration_id !== id));
  }

  // --- Configuration CRUD --------------------------------------------------

  /** Distinct configuration names, sorted, for the dropdown. */
  configurationNames(): string[] {
    const names = new Set(this.configurations().map((c) => c.configuration_name));
    return [...names].sort((a, b) => a.localeCompare(b));
  }

  async createConfiguration(input: Omit<Configuration, 'configuration_id'>): Promise<Configuration> {
    const id = `conf_${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const configuration: Configuration = {
      ...input,
      configuration_id: id,
      updated_at: now,
    };
    await this.db.create<Configuration>(TABLE.configurations, id, configuration);
    this.configurations.update((list) => [...list, configuration]);
    return configuration;
  }

  async updateConfiguration(id: string, patch: Partial<Configuration>): Promise<void> {
    const updated = { ...patch, updated_at: new Date().toISOString() };
    await this.db.update<Configuration>(TABLE.configurations, id, updated);
    this.configurations.update((list) =>
      list.map((c) => (c.configuration_id === id ? { ...c, ...updated } : c)),
    );
  }

  async deleteConfiguration(id: string): Promise<void> {
    await this.db.remove(TABLE.configurations, id);
    this.configurations.update((list) => list.filter((c) => c.configuration_id !== id));
  }

  private toMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
  }
}
