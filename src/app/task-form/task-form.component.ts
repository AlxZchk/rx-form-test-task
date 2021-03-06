import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { fromEvent, pipe, Observable, combineLatest, concat, merge } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  pluck,
  tap,
  withLatestFrom,
  map,
  filter,
  first,
  startWith
} from 'rxjs/operators';
import { ValidationResult } from '../interfaces/validation-result';

@Component({
  selector: 'app-task-form',
  template: `
    <div class="container">
      <form class="rx-form">
        <h2 class="form-title">Register a new account</h2>
        <div class="email">
          <div class="input-container">
            <input #emailField class="input-email" placeholder="EMail" type="email" novalidate>
          </div>
          <div class="validation-error">{{ emailError }}</div>
        </div>
        <div class="password">
          <div class="input-container">
            <input #passwordField class="input-password" placeholder="Password" type="password">
          </div>
          <div class="validation-error">{{ passwordError }}</div>
        </div>
        <div class="password-confirm">
          <div class="input-container">
            <input #passwordConfirmField class="input-password-confirm" placeholder="Confirm password" type="password">
          </div>
          <div class="validation-error">{{ passConfirmationError }}</div>
        </div>
        <div class="submit-button-container">
          <button #submitButton class="submit-button" type="button" [disabled]='!isButtonEnabled'>Register</button>
        </div>
      </form>
    </div>
  `,
  styleUrls: ['./task-form.component.scss']
})
export class TaskFormComponent implements AfterViewInit {
  @ViewChild('emailField') emailFieldRef: ElementRef;
  @ViewChild('passwordField') passwordFieldRef: ElementRef;
  @ViewChild('passwordConfirmField') passwordConfirmFieldRef: ElementRef;
  @ViewChild('submitButton') submitButtonRef: ElementRef;

  emailError: string = null;
  passwordError: string = null;
  passConfirmationError: string = null;

  isButtonEnabled: boolean = false;

  constructor() { }

  ngAfterViewInit(): void {
    const emailValidators: Array<(email: string) => ValidationResult> = [
      this.emailRequiredValidator,
      this.emailPatternValidator,
    ]

    const passwordValidators: Array<(password: string) => ValidationResult> = [
      this.passwordRequiredValidator,
      this.passwordLengthValidator
    ]

    const email$ = this.createInputStream(this.emailFieldRef).pipe(
      map(value => this.executeValidators(value, emailValidators)),
      tap((valResult) => {
         this.emailError = valResult.errorMessage;
      }),
    );

    const password$ = this.createInputStream(this.passwordFieldRef).pipe(
      map(value => this.executeValidators(value, passwordValidators)),
      tap((valResult) => {
        this.passwordError = valResult.errorMessage;
      }),
    );

    const passwordConfirmInput$ = this.createInputStream(this.passwordConfirmFieldRef)

    const passFirstConfirmBlur$ = fromEvent(
      this.passwordConfirmFieldRef.nativeElement, 'blur'
    ).pipe(first());

    /*
    *   Run the first confirm pass validation after the first blur on confirm field
    *   and on password/confirm input afterwards
    */
    const passwordConfirm$ = concat(
        passFirstConfirmBlur$,
        merge(passwordConfirmInput$, password$)
    ).pipe(
      withLatestFrom(passwordConfirmInput$.pipe(
        startWith('')
      )),
      map(([source, confirm]) => confirm),
      withLatestFrom(password$.pipe(
        startWith(getValidationSuccess('')),
        pluck('value')
      )),
      map(([confirm, password]) => this.passwordConfirmMatchValidator(confirm, password)),
      tap((valResult) => {
        this.passConfirmationError = valResult.errorMessage;
      })
    );

    const formData$ = combineLatest(email$, password$, passwordConfirm$).pipe(
      tap((valResults) => { this.isButtonEnabled = valResults.every(result => result.valid) }),
      filter((valResults) => valResults.every(result => result.valid)),
      map(([email, password, confirm]) =>
        `EMail: ${email.value}, Password: ${password.value}, Confirm: ${confirm.value}`)
    );

    const buttonClicks$ = fromEvent(this.submitButtonRef.nativeElement, 'click');

    const app$ = buttonClicks$.pipe(
      withLatestFrom(formData$),
      map(([click, formData]) => formData)
    );

    app$.subscribe(alert);
  }



  private createInputStream(elementRef: ElementRef): Observable<any> {
    const formInputPipe = pipe(
      debounceTime<string>(400),
      pluck('target', 'value'),
      distinctUntilChanged()
    );

    return fromEvent(elementRef.nativeElement, 'input').pipe(formInputPipe);
  }

  private executeValidators(value: string, validators: Array<(v: string) => ValidationResult>): ValidationResult {
    let result = null;
    for (let validator of validators) {
      result = validator(value);
      if (!result.valid) { return result; }
    }

    return result;
  }

  private emailRequiredValidator(email: string): ValidationResult {
    return email ?
      getValidationSuccess(email) :
      getValidationFail(email, 'Email is required.')
  }

  private emailPatternValidator(email: string): ValidationResult {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email) ?
      getValidationSuccess(email) :
      getValidationFail(email, 'Email must be valid.')
  }

  private passwordRequiredValidator(password: string): ValidationResult {
    return password ?
      getValidationSuccess(password) :
      getValidationFail(password, 'Password is required.')
  }

  private passwordLengthValidator(password: string): ValidationResult {
    return password.length >= 4 ?
      getValidationSuccess(password) :
      getValidationFail(password, 'Password must be at least 4 characters long.')
  }

  private passwordConfirmMatchValidator(confirm: string, password: string): ValidationResult {
    return confirm == password ?
      getValidationSuccess(confirm) : getValidationFail(confirm, 'Passwords do not match.');
  }
}

function getValidationSuccess(value: string): ValidationResult {
  return { valid: true, value, errorMessage: null}
}

function getValidationFail(value: string, errorMessage: string): ValidationResult {
  return { valid: false, value, errorMessage };
}


