// monitoring/OriginalConsole.js

export const OriginalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
  table: console.table.bind(console),
  group: console.group.bind(console),
  groupEnd: console.groupEnd.bind(console),
};
