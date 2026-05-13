import { Logger, ILogObj, ILogObjMeta } from "tslog";
import { appendFileSync, mkdirSync } from "fs";

const logger = new Logger({
  name: "TwNotifier",
  minLevel: 2,
  type: "pretty",
  prettyLogTemplate:
    "{{dd}}.{{mm}}.{{yyyy}} {{hh}}:{{MM}}:{{ss}} [{{logLevelName}}] {{name}} ",
  prettyErrorTemplate: "\n{{errorName}} {{errorMessage}}\n{{errorStack}}",
});

mkdirSync("logs", { recursive: true });

logger.attachTransport((logObj: ILogObj) => {
  const { _meta, ...data } = logObj as ILogObj & { _meta: ILogObjMeta };

  const line = JSON.stringify({
    level: _meta?.logLevelName,
    time: _meta?.date,
    name: _meta?.name,
    ...data,
  });

  appendFileSync("logs/app.log", line + "\n");
});

export default logger;
