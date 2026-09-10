import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { NotificationService } from '../../../../core/notifications/notification.service';
import {
  AdminMatrixQuestionCreateInitialValue,
  AdminMatrixQuestionDetailDto,
  AdminMatrixQuestionPayload,
} from '../../models/matrix-question-workspace.model';
import { MatrixQuestionWorkspaceService } from '../../services/matrix-question-workspace.service';
import { MatrixQuestionFormComponent } from '../../components/matrix-question-form/matrix-question-form.component';
import { AdminUnsavedChangesScope } from '../../services/admin-unsaved-changes.service';
import { MatrixQuestionDetailPageComponent } from './matrix-question-detail-page.component';

const INCOMPLETE_QUESTION_ID = '00000000000000000000000000000007';
const READY_QUESTION_ID = '00000000000000000000000000000008';

describe('MatrixQuestionDetailPageComponent', () => {
  let fixture: ComponentFixture<MatrixQuestionDetailPageComponent>;
  let routeParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let routeQueryParams: ReturnType<typeof convertToParamMap>;
  let service: jest.Mocked<MatrixQuestionWorkspaceService>;
  let router: Router;
  let notifications: { success: jest.Mock; error: jest.Mock };

  beforeEach(async () => {
    routeParams = new BehaviorSubject(convertToParamMap({ id: INCOMPLETE_QUESTION_ID }));
    routeQueryParams = convertToParamMap({});
    service = {
      getQuestion: jest.fn().mockReturnValue(of(incompleteQuestion())),
      updateQuestion: jest.fn().mockReturnValue(of(readyQuestion('Draft'))),
      publishQuestion: jest.fn().mockReturnValue(of(undefined)),
      unpublishQuestion: jest.fn().mockReturnValue(of(undefined)),
      deleteQuestion: jest.fn().mockReturnValue(of(undefined)),
    } as unknown as jest.Mocked<MatrixQuestionWorkspaceService>;
    notifications = { success: jest.fn(), error: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [MatrixQuestionDetailPageComponent],
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        { provide: MatrixQuestionWorkspaceService, useValue: service },
        { provide: NotificationService, useValue: notifications },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: routeParams.asObservable(),
            snapshot: {
              get paramMap() {
                return routeParams.value;
              },
              get queryParamMap() {
                return routeQueryParams;
              },
            },
          },
        },
      ],
    })
      .overrideComponent(MatrixQuestionDetailPageComponent, {
        remove: { imports: [MatrixQuestionFormComponent] },
        add: { imports: [MatrixQuestionFormStubComponent] },
      })
      .compileComponents();

    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(MatrixQuestionDetailPageComponent);
    fixture.detectChanges();
  });

  it('loads matrix question detail and renders the duplicated actions dropdown', () => {
    expect(service.getQuestion).toHaveBeenCalledWith(INCOMPLETE_QUESTION_ID, 'ru');
    expect(fixture.nativeElement.textContent).toContain('Incomplete question?');
    expect(
      fixture.nativeElement.querySelector('[data-testid="matrix-detail-actions-toggle"]'),
    ).not.toBeNull();
  });

  it('saves the matrix question through the admin detail endpoint', () => {
    const form = fixture.debugElement.query(By.directive(MatrixQuestionFormStubComponent))
      ?.componentInstance as MatrixQuestionFormStubComponent | undefined;
    expect(form).toBeDefined();

    form?.questionSave.emit(questionPayload('ready-question', 'Published'));

    expect(service.updateQuestion).toHaveBeenCalledWith(
      INCOMPLETE_QUESTION_ID,
      questionPayload('ready-question', 'Published'),
      'ru',
    );
  });

  it('blocks publishing when the persisted detail is incomplete', () => {
    openDetailActions();
    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-detail-actions-publish"]')
      ?.click();

    expect(service.publishQuestion).not.toHaveBeenCalled();
    expect(notifications.error.mock.calls[0][0]).toContain('Нельзя опубликовать вопрос');
  });

  it('does not publish when discarding an edited draft is cancelled', () => {
    service.getQuestion.mockReturnValue(of(readyQuestion('Draft')));
    routeParams.next(convertToParamMap({ id: READY_QUESTION_ID }));
    fixture.detectChanges();
    const draft = signal('baseline');
    fixture.componentInstance.unsavedChangesScope.registerSource(draft, signal(true));
    draft.set('changed');
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);

    openDetailActions();
    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-detail-actions-publish"]')
      ?.click();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(service.publishQuestion).not.toHaveBeenCalled();
  });

  it('publishes, unpublishes, and deletes complete questions from the detail dropdown', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    service.getQuestion.mockReturnValue(of(readyQuestion('Draft')));
    routeParams.next(convertToParamMap({ id: READY_QUESTION_ID }));
    fixture.detectChanges();

    openDetailActions();
    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-detail-actions-publish"]')
      ?.click();
    expect(service.publishQuestion).toHaveBeenCalledWith(READY_QUESTION_ID);

    service.getQuestion.mockReturnValue(of(readyQuestion('Published')));
    routeParams.next(convertToParamMap({ id: READY_QUESTION_ID }));
    fixture.detectChanges();
    openDetailActions();
    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-detail-actions-unpublish"]')
      ?.click();
    openDetailActions();
    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-detail-actions-delete"]')
      ?.click();

    expect(service.unpublishQuestion).toHaveBeenCalledWith(READY_QUESTION_ID);
    expect(window.confirm).toHaveBeenCalled();
    expect(service.deleteQuestion).toHaveBeenCalledWith(READY_QUESTION_ID);
    expect(router.navigate).toHaveBeenCalledWith(['/admin-panel/matrix-questions'], {
      queryParams: { returnTo: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });

  it('returns queue-originated questions to the queue with its query context', () => {
    routeQueryParams = convertToParamMap({ returnTo: 'queue', q: 'typing', sheet: 'python' });

    fixture.componentInstance.goBack();

    expect(router.navigate).toHaveBeenCalledWith(['/admin-panel/matrix-question-queue'], {
      queryParams: { returnTo: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });

  function openDetailActions(): void {
    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-detail-actions-toggle"]')
      ?.click();
    fixture.detectChanges();
  }
});

@Component({
  selector: 'app-admin-matrix-question-form',
  standalone: true,
  template: '',
})
class MatrixQuestionFormStubComponent {
  @Input({ required: true }) unsavedChangesScope!: AdminUnsavedChangesScope;
  @Input({ required: true }) mode!: 'create' | 'edit';
  @Input({ required: true }) question!: AdminMatrixQuestionDetailDto | null;
  @Input({ required: true }) createInitialValue!: AdminMatrixQuestionCreateInitialValue | null;
  @Input({ required: true }) submitting!: boolean;
  @Input({ required: true }) submitLabelKey!: string;
  @Input({ required: true }) showCancelAction!: boolean;
  @Output() readonly questionSave = new EventEmitter<AdminMatrixQuestionPayload>();
  @Output() readonly formCancel = new EventEmitter<void>();
}

function incompleteQuestion(): AdminMatrixQuestionDetailDto {
  return {
    ...readyQuestion('Draft'),
    id: INCOMPLETE_QUESTION_ID,
    slug: 'incomplete-question',
    question: 'Incomplete question?',
    grade: null,
    translations: {
      ru: { question: 'Неполный вопрос?', answer: '', interviewAnswerExplanation: '' },
      en: { question: 'Incomplete question?', answer: '', interviewAnswerExplanation: '' },
    },
  };
}

function readyQuestion(publishStatus: 'Draft' | 'Published'): AdminMatrixQuestionDetailDto {
  return {
    id: READY_QUESTION_ID,
    slug: 'ready-question',
    question: 'Ready question?',
    answer: 'Answer',
    interviewAnswerExplanation: 'Explanation',
    subsectionId: '00000000000000000000000000000003',
    sheetKey: 'python',
    sheet: 'Python',
    grade: 'Junior',
    interviewFrequency: 'often',
    section: 'Core',
    subsection: 'Syntax',
    publishStatus,
    suggestedByUsername: 'owner',
    translations: {
      ru: {
        question: 'Готовый вопрос?',
        answer: 'Ответ',
        interviewAnswerExplanation: 'Объяснение ответа',
      },
      en: {
        question: 'Ready question?',
        answer: 'Answer',
        interviewAnswerExplanation: 'Explanation',
      },
    },
    resources: [],
  };
}

function questionPayload(
  slug: string,
  publishStatus: 'Draft' | 'Published',
): AdminMatrixQuestionPayload {
  return {
    slug,
    subsectionId: '00000000000000000000000000000003',
    grade: 'Junior',
    interviewFrequency: 'often',
    publishStatus,
    translations: {
      ru: {
        question: 'Готовый вопрос?',
        answer: 'Ответ',
        interviewAnswerExplanation: 'Объяснение ответа',
      },
      en: {
        question: 'Ready question?',
        answer: 'Answer',
        interviewAnswerExplanation: 'Explanation',
      },
    },
    resources: [],
  };
}
