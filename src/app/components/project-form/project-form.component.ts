import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

import {
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
import { ChecklistEditorComponent } from '../checklist-editor/checklist-editor.component';

@Component({
  selector: 'app-project-form',
  imports: [CommonModule, FormsModule, ChecklistEditorComponent],
  templateUrl: './project-form.component.html',
  styleUrl: './project-form.component.scss',
})
export class ProjectFormComponent implements OnChanges {
  @ViewChild('titleInput') private titleInput?: ElementRef<HTMLInputElement>;

  @Input() visible = false;
  @Input() model: Project | null = null;
  @Input() sponsors: Sponsor[] = [];
  @Input() inspirations: Inspiration[] = [];
  @Input() isEditing = false;

  @Output() save = new EventEmitter<Project>();
  @Output() cancel = new EventEmitter<void>();
  @Output() delete = new EventEmitter<Project>();

  readonly seasonOptions = SEASON_OPTIONS;
  readonly statusOptions = STATUS_OPTIONS;
  readonly difficultyOptions = DIFFICULTY_OPTIONS;
  readonly repostableOptions = REPOSTABLE_OPTIONS;
  readonly interestLevels = INTEREST_LEVELS;

  // Local form state — keeps the form decoupled from the input model so we
  // don't mutate the parent's object until Save fires.
  draft: Project = this.blank();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['model'] || changes['visible']) {
      this.draft = this.clone(this.model) ?? this.blank();
      if (this.visible && !this.isEditing) {
        window.setTimeout(() => this.titleInput?.nativeElement.focus(), 0);
      }
    }
  }

  toggleSeason(season: SeasonOccasion): void {
    const has = this.draft.seasons.includes(season);
    this.draft.seasons = has
      ? this.draft.seasons.filter((s) => s !== season)
      : [...this.draft.seasons, season];
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
    this.cancel.emit();
  }

  onDelete(): void {
    if (this.model) {
      this.delete.emit(this.model);
    }
  }

  isSeasonSelected(season: SeasonOccasion): boolean {
    return this.draft.seasons.includes(season);
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
      seasons: [...model?.seasons],
      materials: (model.materials ?? []).map((m) => ({ ...m })),
      checklist: model.checklist.map((c) => ({ ...c })),
    };
  }
}
