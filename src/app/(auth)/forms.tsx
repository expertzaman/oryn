"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormAction } from "@/components/app/use-form-action";
import { Alert, Button, FieldError, Input, Label } from "@/components/ui";
import { signIn, signUp, type AuthState } from "./actions";

function PasswordField({ error, autoComplete }: { error?: string; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <Label htmlFor="password" hint={autoComplete === "new-password" ? "8+ characters, a letter and a number" : undefined}>
        Password
      </Label>
      <div className="relative">
        <Input id="password" name="password" type={show ? "text" : "password"} autoComplete={autoComplete} required minLength={autoComplete === "new-password" ? 8 : undefined} maxLength={128} invalid={!!error} className="pr-16" aria-describedby={error ? "password-error" : undefined} />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[12px] font-medium text-fg-3 hover:text-fg" aria-pressed={show}>
          {show ? "Hide" : "Show"}
        </button>
      </div>
      <div id="password-error">
        <FieldError>{error}</FieldError>
      </div>
    </div>
  );
}

export function SignUpForm() {
  const [state, onSubmit, pending] = useFormAction<AuthState>(signUp, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" autoComplete="name" required maxLength={80} defaultValue={state.values?.name} invalid={!!fe.name} />
          <FieldError>{fe.name}</FieldError>
        </div>
        <div>
          <Label htmlFor="company">Company</Label>
          <Input id="company" name="company" autoComplete="organization" required maxLength={80} defaultValue={state.values?.company} invalid={!!fe.company} />
          <FieldError>{fe.company}</FieldError>
        </div>
      </div>
      <div>
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} defaultValue={state.values?.email} invalid={!!fe.email} />
        <FieldError>{fe.email}</FieldError>
      </div>
      <PasswordField error={fe.password} autoComplete="new-password" />
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Create account
      </Button>
      <p className="text-center text-[12.5px] leading-relaxed text-fg-3">
        By creating an account you agree to the <Link href="/terms" className="underline underline-offset-2 hover:text-fg">Terms</Link> and{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-fg">Privacy Policy</Link>.
      </p>
    </form>
  );
}

export function SignInForm({ next }: { next?: string }) {
  const [state, onSubmit, pending] = useFormAction<AuthState>(signIn, {});
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <input type="hidden" name="next" value={next ?? "/app"} />
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state.values?.email} />
      </div>
      <PasswordField autoComplete="current-password" />
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Sign in
      </Button>
    </form>
  );
}
