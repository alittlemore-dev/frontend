import { CdkTrapFocus } from '@angular/cdk/a11y';
import { SiteSelectComponent, SiteSelectOption } from '@alittlemore.dev/design-system';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { WorkspaceEvent } from '../../models/events.model';
import { EventEditorInitial } from '../../utils/event-time';
import { CalendarKnowledgeCreateComponent } from '../calendar-knowledge-create/calendar-knowledge-create.component';
import { EventEditorComponent } from '../event-editor/event-editor.component';

type CalendarEntryKind = 'event' | 'birthday' | 'date';

@Component({
  selector: 'app-calendar-entry-create',
  standalone: true,
  imports: [
    CdkTrapFocus,
    ReactiveFormsModule,
    SiteSelectComponent,
    TranslatePipe,
    CalendarKnowledgeCreateComponent,
    EventEditorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendar-entry-create.component.html',
  styleUrl: './calendar-entry-create.component.scss',
})
export class CalendarEntryCreateComponent {
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly eventEditor = viewChild(EventEditorComponent);
  private readonly knowledgeEditor = viewChild(CalendarKnowledgeCreateComponent);
  readonly initial = input.required<EventEditorInitial | null>();
  readonly eventSaved = output<WorkspaceEvent>();
  readonly knowledgeSaved = output<void>();
  readonly closed = output<void>();
  readonly kind = signal<CalendarEntryKind>('event');
  readonly typeControl = new FormControl<CalendarEntryKind>('event', { nonNullable: true });
  readonly typeOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return [
      { value: 'event', label: this.i18n.translate('workspaceDashboard.calendar.type.event') },
      {
        value: 'birthday',
        label: this.i18n.translate('workspaceDashboard.calendar.createBirthday'),
      },
      { value: 'date', label: this.i18n.translate('workspaceDashboard.calendar.createDate') },
    ];
  });
  readonly initialDate = computed(() => this.initial()?.start.slice(0, 10) || null);
  readonly submitting = computed(
    () => this.eventEditor()?.submitting() ?? this.knowledgeEditor()?.submitting() ?? false,
  );

  constructor() {
    this.typeControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((kind) => {
      if (kind === this.kind()) return;
      const editor = this.eventEditor() ?? this.knowledgeEditor();
      if (editor && !editor.confirmDiscard()) {
        this.typeControl.setValue(this.kind(), { emitEvent: false });
        return;
      }
      this.kind.set(kind);
    });
  }

  save(event: Event): void {
    event.preventDefault();
    if (this.submitting()) return;
    const eventEditor = this.eventEditor();
    if (eventEditor) eventEditor.submit();
    else this.knowledgeEditor()?.save();
  }

  close(): void {
    const editor = this.eventEditor() ?? this.knowledgeEditor();
    editor?.close();
  }
}
