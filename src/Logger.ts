import pino from "pino";

const transport = pino.transport({
    targets: [
      {
        target: 'pino/file',
        options: { destination: `${__dirname}/../app.log` },
        level: "info",
      },
      {
        target: 'pino/file',
        options: { destination: `${__dirname}/../debug.log` },
        level: "debug",
      },
      {
        target: 'pino-pretty',
        level: "info",
        options: { }
      },
    ],
  });
  

export default pino(transport);