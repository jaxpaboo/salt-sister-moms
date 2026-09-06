import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

import {
  ChecklistItem,
  DIFFICULTY_OPTIONS,
  INTEREST_LEVELS,
  Project,
  REPOSTABLE_OPTIONS,
  SEASON_OPTIONS,
  STATUS_OPTIONS,
  SeasonOccasion,
} from '../../models/project';
import { Sponsor } from '../../models/sponsor';
import { Inspiration } from '../../models/inspiration';
import { Configuration } from '../../models/configuration';
import { ChecklistEditorComponent, ChecklistViewRequest } from '../checklist-editor/checklist-editor.component';
import { preventEnterSubmit } from '../../utils/forms';

@Component({
  selector: 'app-project-form',
  imports: [CommonModule, FormsModule, ChecklistEditorComponent],
  templateUrl: './project-form.component.html',
  styleUrl: './project-form.component.scss',
})
export class ProjectFormComponent implements OnChanges {
  @ViewChild('titleInput') private titleInput?: ElementRef<HTMLInputElement>;

  readonly preventEnterSubmit = preventEnterSubmit;

  @Input() visible = false;
  @Input() model: Project | null = null;
  @Input() sponsors: Sponsor[] = [];
  @Input() inspirations: Inspiration[] = [];
  @Input() configurations: Configuration[] = [];
  @Input() isEditing = false;

  @Output() save = new EventEmitter<Project>();
  @Output() cancel = new EventEmitter<void>();
  @Output() delete = new EventEmitter<Project>();
  /** Emitted instead of `cancel` when the user tries to close a dirty form —
   *  the parent is expected to confirm before actually closing. */
  @Output() unsavedClose = new EventEmitter<void>();

  readonly difficultyOptions = DIFFICULTY_OPTIONS;
  readonly repostableOptions = REPOSTABLE_OPTIONS;
  readonly interestLevels = INTEREST_LEVELS;

  /**
   * Seasons + statuses come from configuration documents so admins can edit
   * the lists without a code change. If no matching configuration document
   * exists (e.g. on a fresh install before the admin has saved one), the
   * hardcoded defaults from the model are used as a safety net.
   */
  get seasonOptions(): string[] {
    return this.optionsFromConfig('seasons', SEASON_OPTIONS);
  }

  get statusOptions(): string[] {
    return this.optionsFromConfig('status', STATUS_OPTIONS);
  }

  // Local form state — keeps the form decoupled from the input model so we
  // don't mutate the parent's object until Save fires.
  draft: Project = this.blank();

  /**
   * State for the read-only "view" modal that stacks on top of the
   * project form. Populated by `onChecklistView` when the user
   * double-clicks a filter button inside either `<app-checklist-editor>`.
   */
  checklistView: ChecklistViewRequest | null = null;

  // Snapshot of `draft` as of the last time the form was (re)opened, used to
  // detect unsaved edits when the user tries to close it.
  private originalSnapshot = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['model'] || changes['visible'] || changes['isEditing']) {
      this.draft = this.clone(this.model) ?? this.blank();
      // On a brand-new idea, seed the checklist from the 'checklist'
      // configuration document so the user starts with the admin-defined
      // default rows instead of an empty list.
      if (this.visible && !this.isEditing && this.draft.checklist.length === 0) {
        this.draft.checklist = this.defaultChecklistFromConfigs();
      }
      if (this.visible && !this.isEditing) {
        window.setTimeout(() => this.titleInput?.nativeElement.focus(), 0);
      }
      this.originalSnapshot = JSON.stringify(this.draft);
    }
  }

  /** True when the draft has changed since the form was opened. */
  private isDirty(): boolean {
    return JSON.stringify(this.draft) !== this.originalSnapshot;
  }

  toggleSeason(season: string): void {
    const has = this.draft.seasons.includes(season as SeasonOccasion);
    this.draft.seasons = has
      ? this.draft.seasons.filter((s) => s !== season)
      : [...this.draft.seasons, season as SeasonOccasion];
  }

  onSubmit(form: NgForm): void {
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }
    // Sanitize: trim strings, drop empty rows from checklist-style fields.
    const cleaned: Project = {
      ...this.draft,
      idea_title: (this.draft.idea_title ?? '').trim(),
      idea_description: (this.draft.idea_description ?? '').trim(),
      canva_printable: (this.draft.canva_printable ?? '').trim(),
      materials: this.draft.materials.filter((m) => (m.text ?? '').trim().length > 0),
      checklist: this.draft.checklist.filter((c) => (c.text ?? '').trim().length > 0),
    };
    this.save.emit(cleaned);
  }

  onCancel(): void {
    if (this.isDirty()) {
      this.unsavedClose.emit();
      return;
    }
    this.cancel.emit();
  }

  onDelete(): void {
    if (this.model) {
      this.delete.emit(this.model);
    }
  }

  /** Open the stacked read-only view modal. */
  onChecklistView(req: ChecklistViewRequest): void {
    this.checklistView = req;
  }

  closeChecklistView(): void {
    this.checklistView = null;
  }

  isSeasonSelected(season: string): boolean {
    return this.draft.seasons.includes(season as SeasonOccasion);
  }

  private blank(): Project {
    return {
      project_id: '',
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
      updated_at: new Date().toISOString(),
    };
  }

  private clone(model: Project | null): Project | null {
    if (!model) return null;
    return {
      ...model,
      seasons: [...(model.seasons ?? [])],
      materials: (model.materials ?? []).map((m) => ({ ...m })),
      checklist: (model.checklist ?? []).map((c) => ({ ...c })),
    };
  }

  /**
   * Build the default checklist rows from the first configuration document
   * whose `configuration_name` is 'checklist'. Empty/whitespace entries are
   * dropped so the editor never opens with blank rows. Returns `[]` when no
   * matching configuration exists.
   */
  private defaultChecklistFromConfigs(): ChecklistItem[] {
    const config = this.configurations.find((c) => c.configuration_name === 'checklist');
    if (!config) return [];
    return (config.configuration_values ?? [])
      .map((v) => (v ?? '').trim())
      .filter((v) => v.length > 0)
      .map((text) => ({ text, done: false }));
  }

  /**
   * Read a single configuration document by name and return its trimmed,
   * non-empty values. Falls back to the supplied defaults if no document
   * with that name exists, so the form still renders on first run.
   */
  private optionsFromConfig(name: string, fallback: readonly string[]): string[] {
    const config = this.configurations.find((c) => c.configuration_name === name);
    if (!config) return [...fallback];
    const values = (config.configuration_values ?? [])
      .map((v) => (v ?? '').trim())
      .filter((v) => v.length > 0);
    return values.length > 0 ? values : [...fallback];
  }
}
