import signale from "signale";

export interface Logger {
  info(...args: unknown[]): unknown;
  warn(...args: unknown[]): unknown;
}

export function getLogger(): Logger {
  return globalLogger;
}

const globalLogger = new signale.Signale({
  config: {
    displayScope: false,
    displayBadge: true,
    displayDate: true,
    displayTimestamp: true,
    displayFilename: false,
    displayLabel: false,
  },
});
