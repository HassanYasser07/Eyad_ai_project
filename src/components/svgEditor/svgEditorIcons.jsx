import React from "react";

/**
 * Duotone icon set for the SVG editor's mobile bottom bars and action buttons.
 *
 * Every icon is drawn on a 24 × 24 grid with a rounded 1.7 px outline (currentColor) and a soft
 * tinted fill (currentColor at 16 %), so they pick up the tab colour, look the same in both bars
 * and stay crisp at any size. The stroke width is set on the <svg> element, so CSS can tune it.
 */
function Icon({ size = 22, className = "", children, ...rest }) {
  return (
    <svg
      className={`svg-editor-duo-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

const TINT = { fill: "currentColor", fillOpacity: 0.16 };

export const LayersIcon = (props) => (
  <Icon {...props}>
    <path d="M12 3 3 8l9 5 9-5-9-5Z" {...TINT} />
    <path d="m3 12.5 9 5 9-5" />
    <path d="m3 16.8 9 5 9-5" />
  </Icon>
);

export const ArrangeIcon = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="2.6" {...TINT} />
    <path d="M12 3.5v5.2M12 15.3v5.2M3.5 12h5.2M15.3 12h5.2" />
    <path d="m9.6 5.9 2.4-2.4 2.4 2.4M9.6 18.1l2.4 2.4 2.4-2.4M5.9 9.6 3.5 12l2.4 2.4M18.1 9.6l2.4 2.4-2.4 2.4" />
  </Icon>
);

export const SizeIcon = (props) => (
  <Icon {...props}>
    <rect x="7.6" y="7.6" width="8.8" height="8.8" rx="2.2" {...TINT} />
    <path d="M14.5 3.5h6v6M9.5 20.5h-6v-6" />
    <path d="m20.5 3.5-5.2 5.2M3.5 20.5l5.2-5.2" />
  </Icon>
);

export const ColorsIcon = (props) => (
  <Icon {...props}>
    <path
      d="M12 3.2a8.8 8.8 0 1 0 0 17.6c1.2 0 1.9-.9 1.9-1.9 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-1.9 1.9-1.9h2.3a3.9 3.9 0 0 0 3.9-3.9c0-4-4-6.5-9-6.5Z"
      {...TINT}
    />
    <circle cx="7.6" cy="11.4" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="10.2" cy="7.4" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="14.6" cy="7.2" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="17.4" cy="10.6" r="1.15" fill="currentColor" stroke="none" />
  </Icon>
);

export const TextIcon = (props) => (
  <Icon {...props}>
    <rect x="4.5" y="4.5" width="15" height="3.4" rx="1.4" {...TINT} />
    <path d="M4.5 7.9V6.2c0-.9.8-1.7 1.7-1.7h11.6c.9 0 1.7.8 1.7 1.7v1.7" />
    <path d="M12 4.5v15M9 19.5h6" />
  </Icon>
);

export const TypographyIcon = (props) => (
  <Icon {...props}>
    <circle cx="17.2" cy="15.6" r="2.7" {...TINT} />
    <path d="m3 19.2 5.2-14 5.2 14M5.1 14.2h6.2" />
    <path d="M19.9 12.9v6.3" />
  </Icon>
);

export const BackgroundIcon = (props) => (
  <Icon {...props}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="3.4" {...TINT} />
    <circle cx="8.6" cy="9.4" r="1.6" />
    <path d="m3.8 16.6 4.6-4.5a1.9 1.9 0 0 1 2.6 0l5 4.9" />
    <path d="m14.4 14.9 1.5-1.5a1.9 1.9 0 0 1 2.6 0l2 2" />
  </Icon>
);

export const SolidIcon = (props) => (
  <Icon {...props}>
    <path d="M12 3.1s6.4 6.3 6.4 11a6.4 6.4 0 0 1-12.8 0c0-4.7 6.4-11 6.4-11Z" {...TINT} />
    <path d="M9.2 14.6a3 3 0 0 0 2.6 2.7" />
  </Icon>
);

export const GradientIcon = (props) => (
  <Icon {...props}>
    <path d="M3.5 8A4.5 4.5 0 0 1 8 3.5h1.6v17H8A4.5 4.5 0 0 1 3.5 16Z" fill="currentColor" fillOpacity={0.1} stroke="none" />
    <path d="M9.6 3.5h4.8v17H9.6Z" fill="currentColor" fillOpacity={0.24} stroke="none" />
    <path d="M14.4 3.5H16A4.5 4.5 0 0 1 20.5 8v8a4.5 4.5 0 0 1-4.5 4.5h-1.6Z" fill="currentColor" fillOpacity={0.42} stroke="none" />
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
  </Icon>
);

export const ImageIcon = (props) => (
  <Icon {...props}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" {...TINT} />
    <circle cx="9" cy="9" r="1.7" />
    <path d="m3.8 16.4 4.7-4.5a1.9 1.9 0 0 1 2.6 0L20.5 17" />
  </Icon>
);

export const ResetIcon = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="2.4" {...TINT} />
    <path d="M3.6 12a8.4 8.4 0 1 0 2.6-6.1" />
    <path d="M3.6 3.9v4.4h4.4" />
  </Icon>
);

export const BackIcon = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.6" {...TINT} />
    <path d="m13.2 8.4-3.6 3.6 3.6 3.6" />
  </Icon>
);

export const PenIcon = (props) => (
  <Icon {...props}>
    <path d="M4.2 19.8 5 15.6 15.6 5a2.1 2.1 0 0 1 3 0l.4.4a2.1 2.1 0 0 1 0 3L8.4 19l-4.2.8Z" {...TINT} />
    <path d="m13.8 6.8 3.4 3.4" />
    <path d="M12.6 19.8h7" />
  </Icon>
);

export const UploadIcon = (props) => (
  <Icon {...props}>
    <path d="M7.2 17.6a4.4 4.4 0 0 1-.6-8.7 5.6 5.6 0 0 1 10.8 1.1 3.8 3.8 0 0 1-.4 7.6" {...TINT} />
    <path d="M12 21v-8.2M8.9 15.6 12 12.5l3.1 3.1" />
  </Icon>
);
