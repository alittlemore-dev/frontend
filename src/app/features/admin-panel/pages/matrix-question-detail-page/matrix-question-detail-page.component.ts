import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { ApiError } from '../../../../core/models/api-error.model';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { ErrorMessageComponent } from '../../../../shared/ui/error-message/error-message.component';
import { LoadingSpinnerComponent } from '../../../../shared/ui/loading-spinner/loading-spinner.component';
import {
  AdminAction,
  AdminActionsDropdownComponent,
} from '../../components/admin-actions-dropdown/admin-actions-dropdown.component';
import { MatrixQuestionFormComponent } from '../../components/matrix-question-form/matrix-question-form.component';
import {
  AdminMatrixMissingField,
  AdminMatrixQuestionDetailDto,
  AdminMatrixQuestionPayload,
  buildMatrixQuestionPayloadFromDetail,
  missingMatrixQuestionPayloadFields,
} from '../../models/matrix-question-workspace.model';
import { MatrixQuestionWorkspaceService } from '../../services/matrix-question-workspace.service';
import { AdminUnsavedChangesService } from '../../services/admin-unsaved-changes.service';

@Component({
  selector: 'app-matrix-question-detail-page',
  standalone: true,
  imports: [
    TranslatePipe,
    LoadingSpinnerComponent,
    ErrorMessageComponent,
    AdminActionsDropdownComponent,
    MatrixQuestionFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './matrix-question-detail-page.component.html',
})
export class MatrixQuestionDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly workspaceService = inject(MatrixQuestionWorkspaceService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  readonly unsavedChangesScope = inject(AdminUnsavedChangesService).createScope(this.destroyRef);
  private readonly questionForm = viewChild(MatrixQuestionFormComponent);

  readonly question = signal<AdminMatrixQuestionDetailDto | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly saveError = signal<ApiError | null>(null);
  readonly submitting = signal(false);

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.loadQuestion(questionIdFromParams(params), false);
    });
  }

  loadQuestion(id: string, discardDrafts: boolean): void {
    this.loading.set(true);
    this.error.set(null);
    this.saveError.set(null);
    this.workspaceService
      .getQuestion(id, this.currentLanguage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (question) => {
          if (discardDrafts) {
            this.questionForm()?.discardDraftsAndAcceptQuestion(question);
          }
          this.question.set(question);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err);
          this.loading.set(false);
          this.notifications.error(this.i18n.translate('adminMatrixWorkspace.loadError'));
        },
      });
  }

  saveQuestion(payload: AdminMatrixQuestionPayload): void {
    const question = this.question();
    if (question === null) return;
    this.submitting.set(true);
    this.saveError.set(null);
    this.workspaceService
      .updateQuestion(question.id, payload, this.currentLanguage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.questionForm()?.acceptSavedQuestion(updated);
          this.question.set(updated);
          this.submitting.set(false);
          this.notifications.success(this.i18n.translate('adminMatrixWorkspace.saved'));
        },
        error: (err: ApiError) => {
          this.saveError.set(err);
          this.submitting.set(false);
          this.notifications.error(this.i18n.translate('adminMatrixWorkspace.saveError'));
        },
      });
  }

  retryLoadQuestion(): void {
    this.loadQuestion(questionIdFromParams(this.route.snapshot.paramMap), false);
  }

  dismissSaveError(): void {
    this.saveError.set(null);
  }

  detailActions(question: AdminMatrixQuestionDetailDto): AdminAction[] {
    return [
      question.publishStatus === 'Published'
        ? {
            id: 'unpublish',
            label: this.i18n.translate('shared.unpublish'),
            destructive: false,
            disabled: false,
          }
        : {
            id: 'publish',
            label: this.i18n.translate('shared.publish'),
            destructive: false,
            disabled: false,
          },
      {
        id: 'delete',
        label: this.i18n.translate('shared.delete'),
        destructive: true,
        disabled: false,
      },
    ];
  }

  handleDetailAction(actionId: string, question: AdminMatrixQuestionDetailDto): void {
    switch (actionId) {
      case 'publish':
        this.publishQuestion(question);
        return;
      case 'unpublish':
        this.unpublishQuestion(question);
        return;
      case 'delete':
        this.deleteQuestion(question);
        return;
      default:
        throw new Error(`Unsupported matrix question detail action: ${actionId}`);
    }
  }

  publishQuestion(question: AdminMatrixQuestionDetailDto): void {
    const missingFields = missingMatrixQuestionPayloadFields(
      buildMatrixQuestionPayloadFromDetail(question),
    );
    if (missingFields.length > 0) {
      this.notifications.error(
        this.i18n.translate('adminMatrixWorkspace.publishMissingFields', {
          fields: this.missingFieldsText(missingFields),
        }),
      );
      return;
    }
    if (!this.unsavedChangesScope.confirmDiscard()) return;
    this.workspaceService
      .publishQuestion(question.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifications.success(this.i18n.translate('matrix.notify.published'));
          this.loadQuestion(question.id, true);
        },
        error: () => this.notifications.error(this.i18n.translate('matrix.notify.publishError')),
      });
  }

  unpublishQuestion(question: AdminMatrixQuestionDetailDto): void {
    if (!this.unsavedChangesScope.confirmDiscard()) return;
    this.workspaceService
      .unpublishQuestion(question.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifications.success(this.i18n.translate('matrix.notify.unpublished'));
          this.loadQuestion(question.id, true);
        },
        error: () => this.notifications.error(this.i18n.translate('matrix.notify.unpublishError')),
      });
  }

  deleteQuestion(question: AdminMatrixQuestionDetailDto): void {
    if (
      this.document.defaultView?.confirm(
        this.i18n.translate('adminMatrixWorkspace.confirmDelete'),
      ) !== true
    ) {
      return;
    }
    this.workspaceService
      .deleteQuestion(question.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.unsavedChangesScope.commit();
          this.notifications.success(this.i18n.translate('matrix.notify.deleted'));
          this.navigateToSourceList();
        },
        error: () => this.notifications.error(this.i18n.translate('matrix.notify.deleteError')),
      });
  }

  goBack(): void {
    this.navigateToSourceList();
  }

  private navigateToSourceList(): void {
    const returnToValues = this.route.snapshot.queryParamMap.getAll('returnTo');
    const destination =
      returnToValues.length === 1 && returnToValues[0] === 'queue'
        ? ['/admin-panel/matrix-question-queue']
        : ['/admin-panel/matrix-questions'];
    void this.router.navigate(destination, {
      queryParams: { returnTo: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private missingFieldLabel(field: string): string {
    return this.i18n.translate(`matrix.readiness.field.${field}`);
  }

  private missingFieldsText(fields: readonly AdminMatrixMissingField[]): string {
    return fields.map((field) => this.missingFieldLabel(field)).join(', ');
  }

  private currentLanguage(): 'ru' | 'en' {
    const language = this.i18n.language();
    if (language === null) {
      throw new Error('I18n language is not initialized');
    }
    return language;
  }
}

function questionIdFromParams(params: ParamMap): string {
  const id = params.get('id');
  if (id === null) {
    throw new Error('Matrix question id route parameter is required');
  }
  return id;
}
