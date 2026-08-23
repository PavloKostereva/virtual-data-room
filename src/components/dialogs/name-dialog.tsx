"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { splitBaseName } from "@/lib/name";

interface NameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label: string;
  initialValue: string;
  submitLabel: string;
  isSubmitting: boolean;
  error?: string | null;

  suggestion?: string | null;
  onSubmit: (value: string) => void;
}

export function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  initialValue,
  submitLabel,
  isSubmitting,
  error,
  suggestion,
  onSubmit,
}: NameDialogProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setValue(initialValue);

    const frame = requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(0, splitBaseName(initialValue).length);
    });
    return () => cancelAnimationFrame(frame);
  }, [open, initialValue]);

  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0 && !isSubmitting;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (canSubmit) onSubmit(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader title={title} description={description} />
        <form onSubmit={handleSubmit}>
          <Field label={label} htmlFor="name-dialog-input" error={error ?? undefined}>
            <Input
              id="name-dialog-input"
              ref={inputRef}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              aria-invalid={Boolean(error)}
              autoComplete="off"
              maxLength={255}
            />
          </Field>

          {suggestion ? (
            <button
              type="button"
              onClick={() => setValue(suggestion)}
              className="mt-2 text-xs font-medium text-primary hover:underline"
            >
              Use “{suggestion}” instead
            </button>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} disabled={!canSubmit}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
