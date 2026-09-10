import { Component, WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { I18nService } from './i18n.service';
import { TranslatePipe } from './translate.pipe';

@Component({
  standalone: true,
  imports: [TranslatePipe],
  template: `<span>{{ 'greeting' | t: { name: name } }}</span>`,
})
class HostComponent {
  name = 'Dima';
}

describe('TranslatePipe', () => {
  let fixture: ComponentFixture<HostComponent>;
  let messages: WritableSignal<Record<string, string>>;

  beforeEach(async () => {
    messages = signal({ greeting: 'Hello, {name}' });
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        {
          provide: I18nService,
          useValue: {
            language: signal('en'),
            translate: (key: string, params?: Record<string, string | number>) =>
              messages()[key].replace(`{name}`, String(params?.['name'])),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
  });

  it('renders translated text with interpolation params', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('Hello, Dima');
  });

  it('updates when i18n service output changes', () => {
    fixture.detectChanges();
    messages.set({ greeting: 'Привет, {name}' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('Привет, Dima');
  });
});
