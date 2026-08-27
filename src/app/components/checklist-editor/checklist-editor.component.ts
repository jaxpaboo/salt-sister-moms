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
 * Payload for the editor's `viewRequest` event — tells the parent what
 * the user wants to peek at, in the same order they currently see it.
 */
export interface ChecklistViewRequest {
  /** Section title (e.g. "Materials" / "Checklist") for the modal heading. */
  legend: string;
  /** Pre-formatted lines, each like "(x) text" or "( ) text". */
  lines: string[];
  /** Filter that produced these lines, so the modal heading can name it. */
  filter: 'all' | 'done' | 'pending';
}

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

  /**
   * Emitted on double-click of any filter button. The parent is
   * expected to open a modal that shows the currently-visible rows
   * formatted as `(x) text` / `( ) text` lines. The editor itself
   * never owns that modal — it's a peek, not a mode shift.
   */
  @Output() viewRequest = new EventEmitter<ChecklistViewRequest>();

  // Backing array — same identity as `items` so in-place ngModel edits
  // don't disturb input focus.
  _items: ChecklistItem[] = [];

  // Filter mode: 'all' shows every row; 'done' shows only checked rows;
  // 'pending' shows only unchecked rows. Filter only affects display —
  // the underlying `_items` is never modified by the filter.
  filter: 'all' | 'done' | 'pending' = 'all';

  /**
   * Indices in `_items` that should bypass the current filter. Used so
   * that rows added via `+ Add row` stay visible even when the filter
   * is 'done' or 'pending'. An entry is dropped the moment the user
   * edits that row's text or toggles its checkbox.
   */
  private bypassFilter = new Set<number>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items'] && this.items !== this._items) {
      this._items = this.items ?? [];
      this.bypassFilter.clear();
      // Reset to 'all' every time the parent hands us a new items array
      // (i.e. a different document is being opened), so the user never
      // lands on a stale 'done' or 'pending' filter on first paint.
      if (changes['items'].firstChange || this._itemsAreFresh(changes)) {
        this.filter = 'all';
      }
    }
  }

  /**
   * A new items array means the parent just opened (or switched) a
   * document — reset the filter. Same-reference edits (e.g. the parent
   * reassigning the array after a save) are not treated as fresh.
   */
  private _itemsAreFresh(changes: SimpleChanges): boolean {
    const prev = changes['items'].previousValue as ChecklistItem[] | undefined;
    const curr = changes['items'].currentValue as ChecklistItem[] | undefined;
    return prev !== curr && curr !== undefined;
  }

  /** Items to render under the current filter. */
  visibleItems(): ChecklistItem[] {
    if (this.filter === 'all') return this._items;
    if (this.filter === 'done') {
      return this._items.filter((it, i) => it.done || this.bypassFilter.has(i));
    }
    // 'pending'
    return this._items.filter((it, i) => !it.done || this.bypassFilter.has(i));
  }

  /** Set the filter directly. */
  setFilter(value: 'all' | 'done' | 'pending'): void {
    this.filter = value;
  }

  /**
   * Called when a user types into a row's text input. Drops the row
   * from the bypass set — it's no longer "fresh", so the filter applies
   * normally from now on.
   */
  onRowEdited(index: number): void {
    this.bypassFilter.delete(index);
  }

  /**
   * Open the read-only view: pre-format every currently-visible row
   * as a `(x) text` / `( ) text` line and hand the payload to the
   * parent via `viewRequest`. The parent owns the actual modal.
   */
  openViewModal(): void {
    const lines = this.visibleItems().map(
      (it) => `${it.done ? '(x)' : '( )'} ${it.text}`,
    );
    this.viewRequest.emit({
      legend: this.legend,
      lines,
      filter: this.filter,
    });
  }

  addItem(): void {
    this._items = [...this._items, { text: '', done: false }];
    // Mark the new row so it stays visible regardless of the current
    // filter. The bypass is dropped the first time the user edits it.
    this.bypassFilter.add(this._items.length - 1);
    this.itemsChange.emit(this._items);
  }

  removeItem(index: number): void {
    // Resolve the visible index back to the underlying _items index so
    // filtering doesn't corrupt the data when a row is removed.
    const target = this.visibleItems()[index];
    const realIndex = this._items.indexOf(target);
    if (realIndex < 0) return;
    this._items = this._items.filter((_, i) => i !== realIndex);
    this.itemsChange.emit(this._items);
  }
}
