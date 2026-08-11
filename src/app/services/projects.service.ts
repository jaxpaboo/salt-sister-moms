import { Injectable, inject, signal } from '@angular/core';

import { Project } from '../models/project';
import { Inspiration } from '../models/inspiration';
import { Sponsor } from '../models/sponsor';
import { nextProjectId } from '../models/project-id';
import { DbService } from './db.service';

const TABLE = {
  projects: 'projects',
  sponsors: 'sponsors',
  inspirations: 'inspirations',
} as const;

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private db = inject(DbService);

  readonly projects = signal<Project[]>([]);
  readonly sponsors = signal<Sponsor[]>([]);
  readonly inspirations = signal<Inspiration[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string>('');

  async refreshAll(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [projects, sponsors, inspirations] = await Promise.all([
        this.db.list<Project>(TABLE.projects),
        this.db.list<Sponsor>(TABLE.sponsors),
        this.db.list<Inspiration>(TABLE.inspirations),
      ]);
      this.projects.set(projects);
      this.sponsors.set(sponsors);
      this.inspirations.set(inspirations);
    } catch (e) {
      this.error.set(this.toMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  async createProject(partial: Partial<Project> = {}): Promise<Project> {
    const id = nextProjectId(this.projects());
    const now = new Date().toISOString();
    const project: Project = {
      project_id: id,
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
      materials: '',
      checklist: [],
      repostable: 'Maybe',
      interest_level: null,
      updated_at: now,
      ...partial,
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
    await this.db.remove(TABLE.projects, id);
    this.projects.update((list) => list.filter((p) => p.project_id !== id));
  }

  async createSponsor(input: Omit<Sponsor, 'sponsor_id'>): Promise<Sponsor> {
    const id = `spon_${Date.now().toString(36)}`;
    const sponsor: Sponsor = { sponsor_id: id, ...input };
    await this.db.create<Sponsor>(TABLE.sponsors, id, sponsor);
    this.sponsors.update((list) => [...list, sponsor]);
    return sponsor;
  }

  async createInspiration(input: Omit<Inspiration, 'inspiration_id'>): Promise<Inspiration> {
    const id = `insp_${Date.now().toString(36)}`;
    const inspiration: Inspiration = { inspiration_id: id, ...input };
    await this.db.create<Inspiration>(TABLE.inspirations, id, inspiration);
    this.inspirations.update((list) => [...list, inspiration]);
    return inspiration;
  }

  private toMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
  }
}
