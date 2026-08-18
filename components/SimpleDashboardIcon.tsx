import type { ReactNode } from "react";
import styles from "../styles/SimpleDashboard.module.css";

export type SimpleDashboardIconName =
  | "tests"
  | "folder"
  | "search"
  | "filter"
  | "plus"
  | "arrow"
  | "person"
  | "sparkles"
  | "archive"
  | "copy"
  | "download"
  | "edit"
  | "sliders"
  | "drag";

export function SimpleDashboardIcon({ name }: { name: SimpleDashboardIconName }) {
  const icons: Record<SimpleDashboardIconName, ReactNode> = {
    tests: (
      <>
        <rect data-tone="soft" x="5" y="4.75" width="14" height="15.5" rx="3" />
        <path d="M7.25 6.75v11.5h9.5V6.75" />
        <path data-tone="accent" d="M9.25 5.75V4.2h5.5v1.55" />
        <path d="m9.1 11.05 1.15 1.15 2.05-2.25M9.1 15.55h5.8" />
      </>
    ),
    folder: (
      <>
        <path data-tone="soft" d="M3.1 8.1h17.8v9.35a2.45 2.45 0 0 1-2.45 2.45H5.55a2.45 2.45 0 0 1-2.45-2.45z" />
        <path d="M3.1 8.1h17.8v9.35a2.45 2.45 0 0 1-2.45 2.45H5.55a2.45 2.45 0 0 1-2.45-2.45z" />
        <path data-tone="accent" d="M3.1 8.1V6.55A2.45 2.45 0 0 1 5.55 4.1H9l2.2 2.35h7.25c1.35 0 2.45 1.1 2.45 2.45" />
      </>
    ),
    search: (
      <>
        <circle data-tone="soft" cx="10.25" cy="10.25" r="6.15" />
        <circle cx="10.25" cy="10.25" r="5.55" />
        <path d="m14.55 14.55 5.15 5.15" />
        <circle data-tone="solid-accent" cx="8.5" cy="8.15" r="1.05" />
      </>
    ),
    filter: (
      <>
        <path data-tone="soft" d="M3.6 5.15h16.8l-6.2 7.15v5.4l-4.4 2.2v-7.6z" />
        <path d="M3.6 5.15h16.8l-6.2 7.15v5.4l-4.4 2.2v-7.6z" />
        <path data-tone="accent" d="M7.35 8.15h9.3" />
      </>
    ),
    plus: (
      <>
        <circle cx="12" cy="12" r="8.75" />
        <path d="M12 7.35v9.3M7.35 12h9.3" />
        <path data-tone="accent" d="M12 3.25a8.75 8.75 0 0 1 8.75 8.75" />
      </>
    ),
    arrow: (
      <>
        <path d="m9 5.5 6.5 6.5L9 18.5" />
        <circle data-tone="solid-accent" cx="15.55" cy="12" r="1.15" />
      </>
    ),
    person: (
      <>
        <circle data-tone="soft" cx="12" cy="8.05" r="4.15" />
        <circle cx="12" cy="7.75" r="3.25" />
        <path d="M5.15 19.65c.55-3.85 2.85-5.75 6.85-5.75s6.3 1.9 6.85 5.75" />
        <path data-tone="accent" d="M8.15 16.1c.9.75 2.2 1.15 3.85 1.15s2.95-.4 3.85-1.15" />
      </>
    ),
    sparkles: (
      <>
        <path data-tone="soft" d="m10.9 2.8 1.35 4.3 4.25 1.35-4.25 1.35-1.35 4.3-1.35-4.3L5.3 8.45 9.55 7.1z" />
        <path data-tone="accent" d="m10.9 2.8 1.35 4.3 4.25 1.35-4.25 1.35-1.35 4.3-1.35-4.3L5.3 8.45 9.55 7.1z" />
        <path d="m18.2 12.75.8 2.5 2.5.8-2.5.8-.8 2.5-.8-2.5-2.5-.8 2.5-.8z" />
        <circle data-tone="solid" cx="4.35" cy="16.65" r="1.15" />
      </>
    ),
    archive: (
      <>
        <path data-tone="soft" d="M5 8h14v10.2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
        <path d="M5 8h14v10.2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
        <path data-tone="accent" d="M4 4.2h16v3.8H4z" />
        <path d="M9.2 12h5.6M12 10.7v4.65m0 0-1.8-1.8m1.8 1.8 1.8-1.8" />
      </>
    ),
    copy: (
      <>
        <rect data-tone="soft" x="7.6" y="7.3" width="11.2" height="12.4" rx="2.35" />
        <rect x="7.6" y="7.3" width="11.2" height="12.4" rx="2.35" />
        <path d="M5.7 15.9H5a2.35 2.35 0 0 1-2.35-2.35V5A2.35 2.35 0 0 1 5 2.65h8.55A2.35 2.35 0 0 1 15.9 5v.7" />
        <path data-tone="accent" d="M11 11.15h4.4M11 14.25h4.4" />
      </>
    ),
    download: (
      <>
        <path data-tone="soft" d="M6 3.25h8.35L18 6.9v12.35A1.75 1.75 0 0 1 16.25 21H7.75A1.75 1.75 0 0 1 6 19.25z" />
        <path d="M6 3.25h8.35L18 6.9v12.35A1.75 1.75 0 0 1 16.25 21H7.75A1.75 1.75 0 0 1 6 19.25z" />
        <path data-tone="accent" d="M14.35 3.25V6.9H18M12 8.85v6.35m0 0-2.35-2.35M12 15.2l2.35-2.35" />
        <path d="M9.15 18h5.7" />
      </>
    ),
    edit: (
      <>
        <path data-tone="soft" d="M5.1 4.2h9.2a2 2 0 0 1 2 2v11.6a2 2 0 0 1-2 2H5.1a2 2 0 0 1-2-2V6.2a2 2 0 0 1 2-2z" />
        <path d="M11.5 19.8H5.1a2 2 0 0 1-2-2V6.2a2 2 0 0 1 2-2h9.2a2 2 0 0 1 2 2v3.1" />
        <path data-tone="accent" d="m10.65 17.55.55-3.35 6.8-6.8 2.6 2.6-6.8 6.8zM16.95 8.45l2.6 2.6" />
        <path d="M6.7 8.2h5.05M6.7 11.4h2.8" />
      </>
    ),
    sliders: (
      <>
        <path data-tone="soft" d="M4 5.9h16v12.2H4z" />
        <path d="M4 7.25h7.5M16.5 7.25H20M4 16.75h3.5M12.5 16.75H20" />
        <circle data-tone="accent-fill" cx="14" cy="7.25" r="2.5" />
        <circle data-tone="accent-fill" cx="10" cy="16.75" r="2.5" />
      </>
    ),
    drag: (
      <>
        <rect data-tone="solid" x="6" y="4.5" width="3" height="3" rx="1.5" />
        <rect data-tone="solid-accent" x="15" y="4.5" width="3" height="3" rx="1.5" />
        <rect data-tone="solid" x="6" y="10.5" width="3" height="3" rx="1.5" />
        <rect data-tone="solid-accent" x="15" y="10.5" width="3" height="3" rx="1.5" />
        <rect data-tone="solid" x="6" y="16.5" width="3" height="3" rx="1.5" />
        <rect data-tone="solid-accent" x="15" y="16.5" width="3" height="3" rx="1.5" />
      </>
    ),
  };

  return (
    <svg className={styles.iconGlyph} viewBox="0 0 24 24" aria-hidden="true" data-icon={name}>
      {icons[name]}
    </svg>
  );
}
