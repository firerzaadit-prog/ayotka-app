import type { ReactNode } from "react";

/**
 * Ikon garis sederhana untuk EmptyState - gaya sama dengan ikon fitur di
 * landing page (stroke tunggal, viewBox 24x24), supaya empty state terasa
 * lebih ramah daripada teks polos, terutama di halaman siswa.
 */
type IconProps = { className?: string };

function Base({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className ?? "h-6 w-6"}>
      {children}
    </svg>
  );
}

const strokeProps = { stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function IconInbox(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 12h4l1.5 3h5L16 12h4M4 12l1.5-6.5A1 1 0 0 1 6.47 4h11.06a1 1 0 0 1 .97 1.5L20 12M4 12v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6" {...strokeProps} />
    </Base>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M17 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 5 18.5V20M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M14.5 8.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM17.5 11.5a3 3 0 0 0 0-6" {...strokeProps} />
    </Base>
  );
}

export function IconSchool(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3 3 8l9 5 9-5-9-5ZM3 8v8l9 5 9-5V8M7.5 10.5V16M16.5 10.5V16" {...strokeProps} />
    </Base>
  );
}

export function IconDocument(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" {...strokeProps} />
      <path d="M14 3.5V8h4M9 13h6M9 16.5h6" {...strokeProps} />
    </Base>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 3.5v3M18 3.5v3M4 8.5h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" {...strokeProps} />
    </Base>
  );
}

export function IconChart(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 20V10M10 20V4M16 20v-7M4 20h16" {...strokeProps} />
    </Base>
  );
}

export function IconWallet(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H18a2 2 0 0 1 2 2v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17V7.5Z" {...strokeProps} />
      <path d="M15.5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM4 9h14" {...strokeProps} />
    </Base>
  );
}

export function IconCheckCircle(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" {...strokeProps} />
      <path d="m8.5 12 2.5 2.5 4.5-5" {...strokeProps} />
    </Base>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4.35-4.35" {...strokeProps} />
    </Base>
  );
}

export function IconClipboardCheck(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9 4.5h6a1 1 0 0 1 1 1V6h1.5a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H8v-.5a1 1 0 0 1 1-1Z" {...strokeProps} />
      <path d="M9.5 13.5 11.5 15.5 15 11.5" {...strokeProps} />
    </Base>
  );
}

export function IconLink(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9.5 14.5 14.5 9.5M8 6.5 6.9 7.6a4 4 0 0 0 5.66 5.66L13.7 12M16 17.5l1.1-1.1a4 4 0 0 0-5.66-5.66L10.3 12" {...strokeProps} />
    </Base>
  );
}
