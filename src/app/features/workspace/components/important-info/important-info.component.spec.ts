import { NotificationService } from '@alittlemore.dev/design-system';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { of, Subject } from 'rxjs';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { UnsavedChangesService } from '../../../../core/unsaved-changes/unsaved-changes.service';
import { ImportantInfoService } from '../../services/important-info.service';
import { ImportantInfoComponent } from './important-info.component';

const ITEMS = [
  { id: 'a', text: 'First', position: 1 },
  { id: 'b', text: 'Second', position: 2 },
];

describe('ImportantInfoComponent', () => {
  let fixture: ComponentFixture<ImportantInfoComponent>;
  const service = {
    list: jest.fn(() => of(ITEMS)),
    create: jest.fn(() => of({ id: 'c', text: '', position: 3 })),
    update: jest.fn(() => of({ id: 'a', text: 'Changed', position: 1 })),
    delete: jest.fn(() => of(undefined)),
    reorder: jest.fn(() => of([ITEMS[1]!, ITEMS[0]!])),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ImportantInfoComponent],
      providers: [
        provideI18nTesting(),
        { provide: ImportantInfoService, useValue: service },
        { provide: NotificationService, useValue: { success: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ImportantInfoComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    (fixture.nativeElement as HTMLElement).remove();
    TestBed.resetTestingModule();
  });

  function startEdit(id = 'a'): HTMLInputElement {
    const root = fixture.nativeElement as HTMLElement;
    (
      root.querySelector(`[data-info-id="${id}"] .important-info-display`) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    return root.querySelector(`#important-info-edit-${id}`) as HTMLInputElement;
  }

  it('creates a blank item from the plus in the grid and edits it in place', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.important-info-item')).toHaveLength(2);
    expect(root.querySelector('.important-info-create-input')).toBeNull();
    const add = root.querySelector('.important-info-add') as HTMLButtonElement;
    add.click();
    fixture.detectChanges();
    expect(service.create).toHaveBeenCalledWith('');
    expect(root.querySelectorAll('.important-info-item')).toHaveLength(3);
    expect(root.querySelector('#important-info-edit-c')).not.toBeNull();
    expect(add.getAttribute('aria-label')).toBeTruthy();
  });

  it('can create more than one empty item and leave each empty', () => {
    service.create
      .mockReturnValueOnce(of({ id: 'c', text: '', position: 3 }))
      .mockReturnValueOnce(of({ id: 'd', text: '', position: 4 }));
    const root = fixture.nativeElement as HTMLElement;
    const add = root.querySelector('.important-info-add') as HTMLButtonElement;
    add.click();
    fixture.detectChanges();
    (root.querySelector('#important-info-edit-c') as HTMLInputElement).dispatchEvent(
      new Event('blur'),
    );
    fixture.detectChanges();
    add.click();
    fixture.detectChanges();
    expect(service.create).toHaveBeenCalledTimes(2);
    expect(service.update).not.toHaveBeenCalled();
    expect(root.querySelectorAll('.important-info-item')).toHaveLength(4);
  });

  it('saves an active note before creating the next blank item', () => {
    const root = fixture.nativeElement as HTMLElement;
    const input = startEdit();
    input.value = 'Changed';
    input.dispatchEvent(new Event('input'));
    const add = root.querySelector('.important-info-add') as HTMLButtonElement;
    const pointerDown = new Event('pointerdown', { bubbles: true, cancelable: true });
    add.dispatchEvent(pointerDown);
    expect(pointerDown.defaultPrevented).toBe(true);
    add.click();
    fixture.detectChanges();
    expect(service.update).toHaveBeenCalledWith('a', 'Changed');
    expect(service.create).toHaveBeenCalledWith('');
    expect(root.querySelector('#important-info-edit-c')).not.toBeNull();
  });

  it('edits in place on click and saves on blur', () => {
    const root = fixture.nativeElement as HTMLElement;
    const display = root.querySelector(
      '[data-info-id="a"] .important-info-display',
    ) as HTMLButtonElement;
    display.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(fixture.componentInstance.editingId()).toBeNull();
    const input = startEdit();
    input.value = 'Changed';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(service.update).toHaveBeenCalledWith('a', 'Changed');
    expect(root.querySelector('#important-info-edit-a')).toBeNull();
    expect(
      root.querySelector('[data-info-id="a"] .important-info-display')?.textContent?.trim(),
    ).toBe('Changed');
  });

  it('keeps an unchanged note without sending an update', () => {
    const input = startEdit();
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(service.update).not.toHaveBeenCalled();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('#important-info-edit-a'),
    ).toBeNull();
  });

  it('deletes a note from its labelled minus control', () => {
    const root = fixture.nativeElement as HTMLElement;
    const remove = root.querySelector('.important-info-item .text-danger') as HTMLButtonElement;
    expect(remove.getAttribute('aria-label')).toBeTruthy();
    remove.click();
    fixture.detectChanges();
    expect(service.delete).toHaveBeenCalledWith('a');
    expect(root.querySelectorAll('.important-info-item')).toHaveLength(1);
  });

  it('keeps accessible move buttons disabled at the edges and sends full order', () => {
    const root = fixture.nativeElement as HTMLElement;
    const rows = root.querySelectorAll('.important-info-item');
    const firstUp = rows[0]!.querySelectorAll('button')[1] as HTMLButtonElement;
    const firstDown = rows[0]!.querySelectorAll('button')[2] as HTMLButtonElement;
    expect(firstUp.disabled).toBe(true);
    expect(firstDown.getAttribute('aria-label')).toBeTruthy();
    firstDown.click();
    fixture.detectChanges();
    expect(service.reorder).toHaveBeenCalledWith(['b', 'a']);
  });

  it('saves an active inline edit before reordering through a card action', () => {
    const pending = new Subject<(typeof ITEMS)[number]>();
    service.update.mockReturnValueOnce(pending.asObservable());
    const root = fixture.nativeElement as HTMLElement;
    const input = startEdit();
    const down = root.querySelectorAll('.important-info-item button')[1] as HTMLButtonElement;
    input.value = 'Changed';
    input.dispatchEvent(new Event('input'));
    const pointerDown = new Event('pointerdown', { bubbles: true, cancelable: true });
    down.dispatchEvent(pointerDown);
    expect(pointerDown.defaultPrevented).toBe(true);
    down.click();
    expect(service.update).toHaveBeenCalledWith('a', 'Changed');
    expect(service.reorder).not.toHaveBeenCalled();
    pending.next({ id: 'a', text: 'Changed', position: 1 });
    pending.complete();
    expect(service.reorder).toHaveBeenCalledWith(['b', 'a']);
  });

  it('does not let move or delete controls start a row drag', () => {
    const row = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-info-id="a"]',
    ) as HTMLElement;
    const action = row.querySelector('.text-danger') as HTMLButtonElement;
    const dragStart = jest.fn();
    row.addEventListener('mousedown', dragStart);
    row.addEventListener('touchstart', dragStart);
    row.addEventListener('pointerdown', dragStart);
    action.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    action.dispatchEvent(new Event('touchstart', { bubbles: true }));
    action.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(dragStart).not.toHaveBeenCalled();
  });

  it('lets a click switch to another note while the previous save is pending', () => {
    const pending = new Subject<(typeof ITEMS)[number]>();
    service.update.mockReturnValueOnce(pending.asObservable());
    const root = fixture.nativeElement as HTMLElement;
    const first = startEdit();
    first.value = 'Changed';
    first.dispatchEvent(new Event('input'));
    const second = root.querySelector(
      '[data-info-id="b"] .important-info-display',
    ) as HTMLButtonElement;
    first.dispatchEvent(new FocusEvent('blur', { relatedTarget: second }));
    second.click();
    expect(service.update).toHaveBeenCalledWith('a', 'Changed');
    pending.next({ id: 'a', text: 'Changed', position: 1 });
    pending.complete();
    fixture.detectChanges();
    expect(fixture.componentInstance.editingId()).toBe('b');
    expect(root.querySelector('#important-info-edit-b')).not.toBeNull();
  });

  it('does not delete another note later when its prerequisite edit exceeded the limit', () => {
    service.update.mockReturnValueOnce(of({ id: 'a', text: 'Corrected', position: 1 }));
    const root = fixture.nativeElement as HTMLElement;
    const input = startEdit();
    input.value = 'x'.repeat(256);
    input.dispatchEvent(new Event('input'));
    (root.querySelector('[data-info-id="b"] .text-danger') as HTMLButtonElement).click();
    expect(fixture.componentInstance.editError()).toBe(true);
    expect(service.delete).not.toHaveBeenCalled();
    input.value = 'Corrected';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(service.update).toHaveBeenCalledWith('a', 'Corrected');
    expect(service.delete).not.toHaveBeenCalled();
    expect(root.querySelectorAll('.important-info-item')).toHaveLength(2);
  });

  it('returns keyboard focus to the note after Enter saves or Escape cancels', async () => {
    const root = fixture.nativeElement as HTMLElement;
    document.body.appendChild(root);
    let input = startEdit();
    await fixture.whenStable();
    expect(document.activeElement).toBe(input);
    input.value = 'Changed';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(
      root.querySelector('[data-info-id="a"] .important-info-display'),
    );
    input = startEdit();
    await fixture.whenStable();
    input.value = 'Unsaved';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(
      root.querySelector('[data-info-id="a"] .important-info-display'),
    );
  });

  it('moves focus to an adjacent note after deletion', async () => {
    const root = fixture.nativeElement as HTMLElement;
    document.body.appendChild(root);
    const remove = root.querySelector('[data-info-id="a"] .text-danger') as HTMLButtonElement;
    remove.focus();
    remove.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(
      root.querySelector('[data-info-id="b"] .important-info-display'),
    );
  });

  it('moves focus to the add control when the last note is deleted', async () => {
    const root = fixture.nativeElement as HTMLElement;
    document.body.appendChild(root);
    fixture.componentInstance.items.set([ITEMS[0]!]);
    fixture.detectChanges();
    (root.querySelector('[data-info-id="a"] .text-danger') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(root.querySelector('.important-info-add'));
  });

  it('uses mixed-axis CDK sorting and sends row-major order across columns and rows', () => {
    const component = fixture.componentInstance;
    component.items.set([
      ...ITEMS,
      { id: 'c', text: 'Third', position: 3 },
      { id: 'd', text: 'Fourth', position: 4 },
    ]);
    fixture.detectChanges();
    const list = fixture.debugElement.query(By.directive(CdkDropList)).injector.get(CdkDropList);
    expect(list.orientation).toBe('mixed');
    component.drop({ previousIndex: 0, currentIndex: 1 } as CdkDragDrop<
      readonly (typeof ITEMS)[number][]
    >);
    expect(service.reorder).toHaveBeenLastCalledWith(['b', 'a', 'c', 'd']);
    component.items.set([
      ...ITEMS,
      { id: 'c', text: 'Third', position: 3 },
      { id: 'd', text: 'Fourth', position: 4 },
    ]);
    component.drop({ previousIndex: 0, currentIndex: 2 } as CdkDragDrop<
      readonly (typeof ITEMS)[number][]
    >);
    expect(service.reorder).toHaveBeenLastCalledWith(['b', 'c', 'a', 'd']);
  });

  it('does not create another item while reordering is busy', () => {
    const pending = new Subject<readonly (typeof ITEMS)[number][]>();
    service.reorder.mockReturnValueOnce(pending.asObservable());
    const root = fixture.nativeElement as HTMLElement;
    (
      root
        .querySelectorAll('.important-info-item')[0]!
        .querySelectorAll('button')[2] as HTMLButtonElement
    ).click();
    fixture.componentInstance.add();
    fixture.detectChanges();
    expect(service.create).not.toHaveBeenCalled();
    pending.next([ITEMS[1]!, ITEMS[0]!]);
    pending.complete();
  });

  it('allows clearing an item and shows its empty edit affordance', () => {
    service.update.mockReturnValueOnce(of({ id: 'a', text: '', position: 1 }));
    const root = fixture.nativeElement as HTMLElement;
    const editInput = startEdit();
    editInput.value = '   ';
    editInput.dispatchEvent(new Event('input'));
    expect(TestBed.inject(UnsavedChangesService).hasChanges()).toBe(true);
    editInput.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(service.update).toHaveBeenCalledWith('a', '');
    expect(
      root.querySelector('[data-info-id="a"] .important-info-display')?.textContent?.trim(),
    ).toBeTruthy();
    expect(TestBed.inject(UnsavedChangesService).hasChanges()).toBe(false);
  });

  it('cancels an inline edit with Escape and keeps the stored text', () => {
    const root = fixture.nativeElement as HTMLElement;
    const input = startEdit();
    input.value = 'Changed';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(root.querySelector('#important-info-edit-a')).toBeNull();
    expect(
      root.querySelector('[data-info-id="a"] .important-info-display')?.textContent?.trim(),
    ).toBe('First');
    expect(service.update).not.toHaveBeenCalled();
    expect(TestBed.inject(UnsavedChangesService).hasChanges()).toBe(false);
  });
});
