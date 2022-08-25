import { parse, StackFrame } from 'stacktrace-parser';
import { SERVER_TYPE_ERROR } from '../../constants';

const symbolError = Symbol.for('ShuviError');

type ErrorType = 'server';

export function getFilesystemFrame(frame: StackFrame): StackFrame {
  const f: StackFrame = { ...frame };

  if (typeof f.file === 'string') {
    if (
      // Posix:
      f.file.startsWith('/') ||
      // Win32:
      /^[a-z]:\\/i.test(f.file) ||
      // Win32 UNC:
      f.file.startsWith('\\\\')
    ) {
      f.file = `file://${f.file}`;
    }
  }

  return f;
}

export function decorateServerError(error: Error) {
  Object.defineProperty(error, symbolError, {
    writable: false,
    enumerable: false,
    configurable: false,
    value: SERVER_TYPE_ERROR
  });
}

export function getServerError(error: Error): Error {
  let n: Error;
  try {
    throw new Error(error.message);
  } catch (e) {
    n = e as Error;
  }

  n.name = error.name;
  try {
    n.stack = `${n.toString()}\n${parse(error.stack!)
      .map(getFilesystemFrame)
      .map(f => {
        let str = `    at ${f.methodName}`;
        if (f.file) {
          let loc = f.file;
          if (f.lineNumber) {
            loc += `:${f.lineNumber}`;
            if (f.column) {
              loc += `:${f.column}`;
            }
          }
          str += ` (${loc})`;
        }
        return str;
      })
      .join('\n')}`;
  } catch {
    n.stack = error.stack;
  }

  decorateServerError(n);
  return n;
}

export function getErrorSource(error: Error): ErrorType | null {
  return (error as any)[symbolError] || null;
}
