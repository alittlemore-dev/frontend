import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ErrorMessageComponent } from './error-message.component';

describe('ErrorMessageComponent', () => {
  let fixture: ComponentFixture<ErrorMessageComponent>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorMessageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ErrorMessageComponent);
    fixture.componentRef.setInput('retryLabel', 'Retry');
    el = fixture.nativeElement as HTMLElement;
  });

  it('renders the parent message when there are no nested errors', () => {
    fixture.componentRef.setInput('error', { message: 'Request failed.' });
    fixture.detectChanges();

    expect(el.textContent).toContain('Request failed.');
    expect(el.querySelector('ul')).toBeNull();
  });

  it('renders the parent message with readable attr context', () => {
    fixture.componentRef.setInput('error', {
      message: 'Title is required.',
      attr: 'payload.title',
    });
    fixture.detectChanges();

    expect(el.textContent).toContain('payload / title: Title is required.');
    expect(el.querySelector('ul')).toBeNull();
  });

  it('uses location context when attr is not available', () => {
    fixture.componentRef.setInput('error', {
      message: 'Payload is invalid.',
      location: 'body',
      attr: null,
    });
    fixture.detectChanges();

    expect(el.textContent).toContain('body: Payload is invalid.');
    expect(el.querySelector('ul')).toBeNull();
  });

  it('renders only flattened nested messages when nested errors are present', () => {
    fixture.componentRef.setInput('error', {
      message: 'Multiple errors occurred. Please check list for nested_errors.',
      nested_errors: [
        {
          message: 'Row 2: question must not be empty.',
          nested_errors: [{ message: 'Cell A2 is blank.' }],
        },
        { message: 'Row 3: question must be text.' },
      ],
    });
    fixture.detectChanges();

    const items = Array.from(el.querySelectorAll('li')).map((item) => item.textContent?.trim());
    expect(el.textContent).not.toContain(
      'Multiple errors occurred. Please check list for nested_errors.',
    );
    expect(items).toEqual([
      'Row 2: question must not be empty.',
      'Cell A2 is blank.',
      'Row 3: question must be text.',
    ]);
  });

  it('renders flattened nested messages with readable attr context', () => {
    fixture.componentRef.setInput('error', {
      message: 'Question queue import file is invalid.',
      nested_errors: [
        {
          message: 'Row 2 question must not be blank.',
          location: 'body',
          attr: 'file.row.2',
        },
      ],
    });
    fixture.detectChanges();

    const items = Array.from(el.querySelectorAll('li')).map((item) => item.textContent?.trim());
    expect(items).toEqual(['file / row 2: Row 2 question must not be blank.']);
  });

  it('emits retry events from the retry button', () => {
    const retries: void[] = [];
    fixture.componentInstance.retry.subscribe((event) => retries.push(event));
    fixture.componentRef.setInput('error', { message: 'Request failed.' });
    fixture.detectChanges();

    el.querySelector<HTMLButtonElement>('button')?.click();

    expect(retries).toHaveLength(1);
  });
});
