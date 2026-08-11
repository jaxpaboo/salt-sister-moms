import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirmation-toast',
  imports: [CommonModule],
  templateUrl: './confirmation-toast.component.html',
  styleUrl: './confirmation-toast.component.scss',
})
export class ConfirmationToastComponent {
  @Input() visible = false;
  @Input() message = '';

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
}
