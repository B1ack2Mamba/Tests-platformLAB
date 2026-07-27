import { useEffect, useState } from "react";

import IndiDesktop3D from "../indi3d/IndiDesktop3D";
import type { ExecutiveLabWorkspace } from "../../lib/executiveLab";
import styles from "../../styles/ExecutiveLab.module.css";

type BootstrapResponse =
  | { ok: true; workspace: ExecutiveLabWorkspace }
  | { ok: false; error: string };

export default function ExecutiveLabWorkspacePage() {
  const [workspace, setWorkspace] = useState<ExecutiveLabWorkspace | null>(null);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [folderTitle, setFolderTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadWorkspace() {
      setError("");
      try {
        const response = await fetch("/api/executive-lab/bootstrap", {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = (await response.json()) as BootstrapResponse;
        if (!response.ok || !payload.ok) {
          throw new Error(payload.ok ? "Не удалось загрузить кабинет" : payload.error);
        }
        setWorkspace(payload.workspace);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить кабинет");
      }
    }

    void loadWorkspace();
    return () => controller.abort();
  }, [reloadToken]);

  if (error) {
    return (
      <main className={styles.statusPage}>
        <section>
          <span>EXECUTIVE SPACE LAB</span>
          <h1>Новая тестовая база пока не ответила</h1>
          <p>{error}</p>
          <button onClick={() => setReloadToken((value) => value + 1)}>Повторить подключение</button>
          <small>Основной коммерческий проект при этой проверке не используется.</small>
        </section>
      </main>
    );
  }

  if (!workspace) {
    return (
      <main className={styles.statusPage}>
        <section>
          <span>EXECUTIVE SPACE LAB</span>
          <h1>Собираем рабочее пространство</h1>
          <div className={styles.loadingTrack}><i /></div>
          <small>Подключение идёт только к тестовому Supabase.</small>
        </section>
      </main>
    );
  }

  async function createProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const response = await fetch("/api/executive-lab/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: projectTitle, folderTitle }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Не удалось создать проект");

      setCreateOpen(false);
      setProjectTitle("");
      setFolderTitle("");
      setReloadToken((value) => value + 1);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Не удалось создать проект");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <IndiDesktop3D
        workspace={workspace}
        labName="Executive Space"
        onCreateProject={() => setCreateOpen(true)}
      />

      {createOpen ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setCreateOpen(false)}>
          <section
            className={styles.createModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="executive-create-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className={styles.modalClose} onClick={() => setCreateOpen(false)} aria-label="Закрыть">×</button>
            <span>НОВАЯ ПАПКА</span>
            <h2 id="executive-create-title">Создать проект</h2>
            <p>Проект сразу появится в центральной книге и сохранится в новой тестовой базе.</p>
            <form onSubmit={createProject}>
              <label>
                Название проекта
                <input
                  value={projectTitle}
                  onChange={(event) => setProjectTitle(event.target.value)}
                  placeholder="Например, Оценка руководителей"
                  minLength={3}
                  maxLength={120}
                  autoFocus
                  required
                />
              </label>
              <label>
                Подпись папки
                <input
                  value={folderTitle}
                  onChange={(event) => setFolderTitle(event.target.value)}
                  placeholder="Короткое название"
                  maxLength={40}
                />
              </label>
              {formError ? <strong className={styles.formError}>{formError}</strong> : null}
              <button type="submit" disabled={saving}>
                {saving ? "Создаём..." : "Создать проект"}
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
