"use client";

import { useEffect, useState } from "react";
import ChartHelp from "@/components/ChartHelp";
import { getUser } from "@/lib/auth";
import { KEYBOARD_LAYOUTS, layoutLabel } from "@/lib/keyboards";
import { useKeyboards } from "@/lib/useKeyboards";
import type { Keyboard, KeyboardLayout } from "@/lib/types";

function KeyboardIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h.01M12 14h.01M16 14h.01" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6M9 6V4h6v2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export default function KeyboardSettings() {
  const loggedIn = !!getUser();
  const { keyboards, loading, create, update, remove, setActive } = useKeyboards();
  const [name, setName] = useState("");
  const [layout, setLayout] = useState<KeyboardLayout>("qwerty");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLayout, setEditLayout] = useState<KeyboardLayout>("qwerty");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!editingId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditingId(null);
        setEditError(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editingId]);

  if (!loggedIn) {
    return (
      <div className="kb-guest">
        <span className="kb-guest-icon" aria-hidden>
          <KeyboardIcon size={22} />
        </span>
        <p>Sign in to register keyboards and track runs by device and layout.</p>
      </div>
    );
  }

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setAdding(true);
    setError(null);
    try {
      await create(trimmed, layout);
      setName("");
    } catch {
      setError("Could not add keyboard. Check your connection and try again.");
    } finally {
      setAdding(false);
    }
  };

  const handleActivate = async (id: string) => {
    setActivatingId(id);
    try {
      await setActive(id);
    } finally {
      setActivatingId(null);
    }
  };

  const startEdit = (kb: Keyboard) => {
    setEditingId(kb.id);
    setEditName(kb.name);
    setEditLayout(kb.layout);
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    const trimmed = editName.trim();
    if (!trimmed) return;
    setSaving(true);
    setEditError(null);
    try {
      await update(editingId, { name: trimmed, layout: editLayout });
      cancelEdit();
    } catch {
      setEditError("Could not save changes. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleAdd();
  };

  return (
    <section className="kb-panel" aria-labelledby="kb-panel-title">
      <header className="kb-header">
        <div className="kb-header-icon" aria-hidden>
          <KeyboardIcon size={20} />
        </div>
        <div className="kb-header-copy">
          <div className="kb-header-title-row">
            <h2 id="kb-panel-title" className="kb-title">
              Keyboards
            </h2>
            <ChartHelp label="About keyboards" size="sm">
              Register each physical keyboard you use. The active keyboard is attached to every
              run so you can filter stats and history by device or layout.
            </ChartHelp>
          </div>
          <p className="kb-subtitle">
            Track performance across devices — switch your active setup before each session.
          </p>
        </div>
      </header>

      {loading && keyboards.length === 0 ? (
        <div className="kb-grid kb-grid-skeleton" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="kb-card kb-card-skeleton" />
          ))}
        </div>
      ) : keyboards.length === 0 ? (
        <div className="kb-empty">
          <div className="kb-empty-icon" aria-hidden>
            <KeyboardIcon size={28} />
          </div>
          <p className="kb-empty-title">No keyboards registered</p>
          <p className="kb-empty-hint">
            Add your first keyboard below — e.g. &ldquo;Keychron K2&rdquo; with your layout.
          </p>
        </div>
      ) : (
        <ul className="kb-grid">
          {keyboards.map((kb, index) => (
            <li
              key={kb.id}
              className="kb-card-wrap"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div
                className="kb-card"
                data-active={kb.isActive}
                data-busy={activatingId === kb.id || (saving && editingId === kb.id)}
                data-editing={editingId === kb.id}
              >
                {editingId === kb.id ? (
                  <form className="kb-card-edit-form" onSubmit={handleSaveEdit}>
                    <p className="kb-edit-title">Edit keyboard</p>
                    <label className="kb-field">
                      <span className="kb-field-label">Name</span>
                      <input
                        type="text"
                        className="kb-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        maxLength={64}
                        autoFocus
                        autoComplete="off"
                      />
                    </label>
                    <fieldset className="kb-field">
                      <legend className="kb-field-label">Layout</legend>
                      <div className="kb-layout-pills kb-layout-pills-compact" role="group" aria-label="Keyboard layout">
                        {KEYBOARD_LAYOUTS.map((l) => (
                          <button
                            key={l}
                            type="button"
                            className="kb-layout-pill"
                            data-selected={editLayout === l}
                            onClick={() => setEditLayout(l)}
                            aria-pressed={editLayout === l}
                          >
                            {layoutLabel(l)}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <div className="kb-edit-actions">
                      <button
                        type="button"
                        className="kb-edit-cancel"
                        onClick={cancelEdit}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="kb-edit-save"
                        disabled={saving || !editName.trim()}
                        aria-busy={saving}
                      >
                        {saving ? (
                          <span className="kb-submit-spinner" aria-hidden />
                        ) : (
                          <CheckIcon />
                        )}
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                    {editError && (
                      <p className="kb-error" role="alert">
                        {editError}
                      </p>
                    )}
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      className="kb-card-main"
                      onClick={() => void handleActivate(kb.id)}
                      aria-pressed={kb.isActive}
                      aria-label={
                        kb.isActive
                          ? `${kb.name}, active keyboard`
                          : `Set ${kb.name} as active keyboard`
                      }
                    >
                      <span className="kb-card-icon" aria-hidden>
                        <KeyboardIcon size={16} />
                      </span>
                      <span className="kb-card-body">
                        <span className="kb-card-name">{kb.name}</span>
                        <span className="kb-card-meta">
                          <span className="kb-layout-chip">{layoutLabel(kb.layout)}</span>
                          {kb.isActive && (
                            <span className="kb-active-badge">
                              <CheckIcon />
                              Active
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                    <div className="kb-card-actions">
                      <button
                        type="button"
                        className="kb-card-edit"
                        aria-label={`Edit ${kb.name}`}
                        onClick={() => startEdit(kb)}
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        className="kb-card-delete"
                        aria-label={`Delete ${kb.name}`}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete "${kb.name}"? Past runs keep their snapshot.`
                            )
                          ) {
                            void remove(kb.id);
                          }
                        }}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form className="kb-add-panel" onSubmit={onSubmit}>
        <p className="kb-add-label">
          <PlusIcon />
          Add keyboard
        </p>
        <div className="kb-add-row">
          <label className="kb-field kb-field-grow">
            <span className="kb-field-label">Name</span>
            <input
              type="text"
              className="kb-input kb-input-lg"
              placeholder="e.g. Keychron K2, MacBook built-in"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
              autoComplete="off"
            />
          </label>
          <fieldset className="kb-field kb-field-layout">
            <legend className="kb-field-label">Layout</legend>
            <div className="kb-layout-pills" role="group" aria-label="Keyboard layout">
              {KEYBOARD_LAYOUTS.map((l) => (
                <button
                  key={l}
                  type="button"
                  className="kb-layout-pill"
                  data-selected={layout === l}
                  onClick={() => setLayout(l)}
                  aria-pressed={layout === l}
                >
                  {layoutLabel(l)}
                </button>
              ))}
            </div>
          </fieldset>
          <button
            type="submit"
            className="kb-submit"
            disabled={adding || !name.trim()}
            aria-busy={adding}
          >
            {adding ? (
              <span className="kb-submit-spinner" aria-hidden />
            ) : (
              <PlusIcon />
            )}
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
        {error && (
          <p className="kb-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
