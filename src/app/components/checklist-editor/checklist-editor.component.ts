import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ChecklistItem } from '../../models/project';

/**
 * Reusable editor for a list of `{ text, done }` rows. Used by both
 * the project Materials field and the project Checklist field.
 *
 * The component shares its array reference with the parent: ngModel
 * mutates the same objects the parent owns, and add/remove operations
 * pass through a fresh array via `itemsChange`. We deliberately do NOT
 * emit on every keystroke — that would cause the parent to reassign the
 * input, which Angular treats as a new array reference, which would
 * destroy row identity and lose input focus.
 */
@Component({
  selector: 'app-checklist-editor',
  imports: [CommonModule, FormsModule],
  templateUrl: './checklist-editor.component.html',
  styleUrl: './checklist-editor.component.scss',
})
export class ChecklistEditorComponent implements OnChanges {
  @Input() legend = '';
  @Input() placeholder = '';
  @Input() items: ChecklistItem[] = [];

  @Output() itemsChange = new EventEmitter<ChecklistItem[]>();

  // Backing array — same identity as `items` so in-place ngModel edits
  // don't disturb input focus.
  _items: ChecklistItem[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items'] && this.items !== this._items) {
      this._items = this.items ?? [];
    }
  }

  addItem(): void {
    this._items = [...this._items, { text: '', done: false }];
    this.itemsChange.emit(this._items);
  }

  removeItem(index: number): void {
    this._items = this._items.filter((_, i) => i !== index);
    this.itemsChange.emit(this._items);
  }
}
