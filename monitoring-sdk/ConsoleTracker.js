// monitoring/ConsoleTracker.js

import { addEvent } from "./EventQueue";
import { OriginalConsole } from "./OriginalConsole";
import { CLIENT_MONITORING_CONFIG } from "./ClientMonitoringConfig";

const METHODS = [
  "log",
  "info",
  "warn",
  "error",
  "debug",
];

function safelyConvertToString(value) {
  try {
    const stringValue = String(value);

    return stringValue === "[object Object]"
      ? "[Unserializable Object]"
      : stringValue;
  } catch (error) {
    return "[Unserializable console value]";
  }
}

function getSerializableError(error) {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...(error.cause !== undefined && { cause: error.cause }),
  };
}

function createConsoleArgumentReplacer() {
  const seenObjects = new WeakSet();

  return (key, value) => {
    if (value === undefined) {
      return "[undefined]";
    }

    if (typeof value === "bigint") {
      return `${value.toString()}n`;
    }

    if (typeof value === "number" && !Number.isFinite(value)) {
      return value.toString();
    }

    if (typeof value === "symbol") {
      return value.toString();
    }

    if (typeof value === "function") {
      return `[Function: ${value.name || "anonymous"}]`;
    }

    if (value === null || typeof value !== "object") {
      return value;
    }

    if (seenObjects.has(value)) {
      return "[Circular]";
    }

    seenObjects.add(value);

    if (value instanceof Error) {
      return getSerializableError(value);
    }

    if (value instanceof Map) {
      return {
        type: "Map",
        entries: Array.from(value.entries()),
      };
    }

    if (value instanceof Set) {
      return {
        type: "Set",
        values: Array.from(value.values()),
      };
    }

    if (value instanceof RegExp) {
      return value.toString();
    }

    if (typeof Element !== "undefined" && value instanceof Element) {
      return value.outerHTML;
    }

    if (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) {
      return Array.from(new Uint8Array(value));
    }

    if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(value)) {
      return Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    }

    return value;
  };
}

function serializeConsoleArgument(argument) {
  try {
    if (typeof argument === "string") {
      return argument;
    }

    if (argument === undefined) {
      return "undefined";
    }

    if (typeof argument === "bigint") {
      return `${argument.toString()}n`;
    }

    if (typeof argument === "number" && !Number.isFinite(argument)) {
      return argument.toString();
    }

    if (typeof argument === "symbol") {
      return argument.toString();
    }

    if (typeof argument === "function") {
      return `[Function: ${argument.name || "anonymous"}]`;
    }

    const valueToSerialize = argument instanceof Error
      ? getSerializableError(argument)
      : argument;
    const serializedArgument = JSON.stringify(
      valueToSerialize,
      createConsoleArgumentReplacer()
    );

    return serializedArgument ?? safelyConvertToString(argument);
  } catch (error) {
    return safelyConvertToString(argument);
  }
}

function shouldIgnoreMessage(message, getCurrentCmId) {
  const defaultConfig = CLIENT_MONITORING_CONFIG.default;
  const clientConfig = CLIENT_MONITORING_CONFIG[getCurrentCmId?.()] || {};
  const exactMessages = [
    ...defaultConfig.EXACT_IGNORED_CONSOLE_MESSAGES,
    ...(clientConfig.EXACT_IGNORED_CONSOLE_MESSAGES || []),
  ];
  const includedPhrases = [
    ...defaultConfig.INCLUDED_IGNORED_CONSOLE_PHRASES,
    ...(clientConfig.INCLUDED_IGNORED_CONSOLE_PHRASES || []),
  ];
  const normalizedMessage = message.toLowerCase();
  const hasExactMatch = exactMessages.some(
    (ignoredMessage) => normalizedMessage === ignoredMessage.toLowerCase()
  );

  if (hasExactMatch) {
    return true;
  }

  return includedPhrases.some((phrase) =>
    normalizedMessage.includes(phrase.toLowerCase())
  );
}

export function startConsoleTracker(getCurrentCmId) {

  METHODS.forEach((method) => {

    console[method] = (...args) => {

      const message = args.map(serializeConsoleArgument).join(" ");

      if (!shouldIgnoreMessage(message, getCurrentCmId)) {
        addEvent({
          id: crypto.randomUUID(),
          type: "console",
          level: method,
          message,
          timestamp: new Date().toISOString(),
        });
      }

      OriginalConsole[method](...args);

    };

  });

}
