import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

import { Configuration } from '../../models/configuration';
import { preventEnterSubmit } from '../../utils/forms';

@Component({
  selector: 'app-configuration-form',
  imports: [CommonModule, FormsModule],
  templateUrl: './configuration-form.component.html',
  styleUrl: './configuration-form.component.scss',
})
export class ConfigurationFormComponent implements OnChanges {
  @ViewChild('nameInput') private nameInput?: ElementRef<HTMLInputElement>;
  @ViewChild('fieldnameInput') private fieldnameInput?: ElementRef<HTMLInputElement>;

  readonly preventEnterSubmit = preventEnterSubmit;

  @Input() visible = false;
  @Input() configurations: Configuration[] = [];
  @Input() model: Configuration | null = null;

  @Output() save = new EventEmitter<Configuration>();
  @Output() cancel = new EventEmitter<void>();
  @Output() delete = new EventEmitter<Configuration>();
  /** Emitted instead of `cancel` when the user tries to close a dirty form —
   *  the parent is expected to confirm before actually closing. */
  @Output() unsavedClose = new EventEmitter<void>();

  // Local form state — keeps the form decoupled from the input model so we
  // don't mutate the parent's object until Save fires.
  draft: Configuration = this.blank();
  isEditing = false;
  showNewNameInput = false;
  selectedName = '__new__';

  // Snapshot of `draft` as of the last time it was reset to a clean baseline
  // (form opened, or a different configuration picked from the dropdown),
  // used to detect unsaved edits when the user tries to close the form.
  private originalSnapshot = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['model'] || changes['visible']) {
      this.draft = this.clone(this.model) ?? this.blank();
      this.isEditing = !!this.draft.configuration_id;
      if (this.isEditing && this.draft.configuration_name) {
        this.selectedName = this.draft.configuration_name;
        this.showNewNameInput = false;
      } else {
        this.selectedName = '__new__';
        this.showNewNameInput = true;
      }
      if (this.visible && !this.isEditing) {
        window.setTimeout(() => this.nameInput?.nativeElement.focus(), 0);
      }
      this.originalSnapshot = JSON.stringify(this.draft);
    }
  }

  /** True when the draft has changed since it was last a clean baseline. */
  private isDirty(): boolean {
    return JSON.stringify(this.draft) !== this.originalSnapshot;
  }

  /** Distinct configuration names for the dropdown, sorted alphabetically. */
  get configurationNames(): string[] {
    const names = new Set(this.configurations.map((c) => c.configuration_name));
    return [...names].sort((a, b) => a.localeCompare(b));
  }

  onNameChange(value: string): void {
    if (value === '__new__') {
      this.showNewNameInput = true;
      this.draft = this.blank();
      this.isEditing = false;
      window.setTimeout(() => this.nameInput?.nativeElement.focus(), 0);
    } else {
      this.showNewNameInput = false;
      const found = this.configurations.find((c) => c.configuration_name === value);
      if (found) {
        this.draft = { ...found };
        this.isEditing = true;
      }
    }
    this.originalSnapshot = JSON.stringify(this.draft);
  }

  /** Sort the configuration values alphabetically (case-insensitive). */
  onSortValues(): void {
    const values = [...(this.draft.configuration_values ?? [])];
    values.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    this.draft.configuration_values = values;
  }

  /**
   * Two-way binding bridge: `configuration_values` is a `string[]`, but the
   * textarea treats it as newline-separated text. Convert in both directions
   * so users still edit one entry per line.
   */
  get valuesText(): string {
    return (this.draft.configuration_values ?? []).join('\n');
  }
  set valuesText(text: string) {
    this.draft.configuration_values = (text ?? '')
      .split('\n')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }

  onSubmit(form: NgForm): void {
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }
    const cleaned: Configuration = {
      ...this.draft,
      configuration_name: (this.draft.configuration_name ?? '').trim(),
      configuration_fieldname: (this.draft.configuration_fieldname ?? '').trim(),
      configuration_values: (this.draft.configuration_values ?? []).map((v) => v.trim()).filter((v) => v.length > 0),
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
    if (this.draft.configuration_id) {
      this.delete.emit({ ...this.draft });
    }
  }

  private blank(): Configuration {
    return {
      configuration_id: '',
      configuration_name: '',
      configuration_fieldname: '',
      configuration_values: [],
      updated_at: new Date().toISOString(),
    };
  }

  private clone(model: Configuration | null): Configuration | null {
    if (!model) return null;
    return { ...model };
  }
}
