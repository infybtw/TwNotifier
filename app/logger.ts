export type LogLevel = "log" | "info" | "warn" | "error";
export type LogFormat = "json" | "pretty" | "plain";

interface LoggerOptions {
  name?: string;
  level?: LogLevel;
  format?: LogFormat;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  log: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  log: "\x1b[90m",   // gray
  info: "\x1b[36m",  // cyan
  warn: "\x1b[33m",  // yellow
  error: "\x1b[31m", // red
};

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

function pad(level: string): string {
  return level.padEnd(5);
}

function formatTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

function formatPlain(level: LogLevel, name: string, message: string, args: unknown[]): string {
  const time = formatTime(new Date());
  const nameStr = name ? ` ${BOLD}[${name}]${RESET}` : "";
  const extra = args.length > 0
    ? " " + args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")
    : "";
  return `${DIM}${time}${RESET} ${LEVEL_COLORS[level]}${pad(level.toUpperCase())}${RESET}${nameStr} ${message}${extra}`;
}

function formatPretty(level: LogLevel, name: string, message: string, args: unknown[]): string {
  const time = formatTime(new Date());
  const color = LEVEL_COLORS[level];
  const nameStr = name ? ` ${DIM}[${name}]${RESET}` : "";
  const extra = args.length > 0
    ? "\n" + args.map((a) => (typeof a === "string" ? a : JSON.stringify(a, null, 2))).join(" ")
    : "";
  return `${DIM}${time}${RESET} ${color}${BOLD}${pad(level.toUpperCase())}${RESET}${nameStr} ${message}${extra}`;
}

function formatJson(level: LogLevel, name: string, message: string, args: unknown[]): string {
  const obj: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  if (name) obj.logger = name;
  if (args.length > 0) {
    const extra = args.length === 1 && typeof args[0] === "object" && args[0] !== null
      ? args[0] as Record<string, unknown>
      : { data: args.length === 1 ? args[0] : args };
    Object.assign(obj, extra);
  }
  const json = JSON.stringify(obj);
  const color = LEVEL_COLORS[level];
  return json.replace(
    `"level":"${level}"`,
    `"level":${color}"${level}"${RESET}`
  );
}

function output(
  level: LogLevel,
  name: string,
  format: LogFormat,
  minLevel: LogLevel,
  message: string,
  ...args: unknown[]
): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) return;

  let line: string;
  switch (format) {
    case "json":
      line = formatJson(level, name, message, args);
      break;
    case "pretty":
      line = formatPretty(level, name, message, args);
      break;
    default:
      line = formatPlain(level, name, message, args);
  }

  if (level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export class Logger {
  private name: string;
  private level: LogLevel;
  private format: LogFormat;

  constructor(opts: LoggerOptions = {}) {
    this.name = opts.name ?? "";
    this.level = opts.level ?? "log";
    this.format = opts.format ?? "pretty";
  }

  getSubLogger(opts: { name: string }): Logger {
    const child = new Logger({
      name: opts.name,
      level: this.level,
      format: this.format,
    });
    return child;
  }

  log(message: string, ...args: unknown[]): void {
    output("log", this.name, this.format, this.level, message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    output("info", this.name, this.format, this.level, message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    output("warn", this.name, this.format, this.level, message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    output("error", this.name, this.format, this.level, message, ...args);
  }
}

const logger = new Logger({
  name: "TwNotifier",
  level: "log",
  format: "json",
});

export default logger;
