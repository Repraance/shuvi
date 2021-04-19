import path from 'path';
import { pauseTracking, resetTracking } from '@vue/reactivity';
import { FileOptions, FileInternalInstance } from './file';
import { mount as mountFile } from './mount';

export interface FileManager {
  addFile(options: FileOptions): void;
  mount(): Promise<void>;
  unmount(): void;
}

export interface FileManagerOptions {
  watch?: boolean;
  rootDir: string;
}

export function getFileManager({
  watch = false,
  rootDir
}: FileManagerOptions): FileManager {
  const files: FileOptions[] = [];
  const instances = new Map<string, FileInternalInstance>();

  const addFile = (options: FileOptions) => {
    const fullPath = path.resolve(rootDir, options.name);
    files.push({
      ...options,
      name: fullPath
    });
  };

  const mount = async () => {
    const tasks = [];
    for (const file of files) {
      tasks.push(async () => {
        try {
          const inst = await mountFile(file);
          instances.set(file.name, inst);
        } catch (error) {
          console.log(`fail to create file ${file.name}`);
          console.error(error);
        }
      });
    }

    if (!watch) {
      pauseTracking();
    }
    await Promise.all(tasks.map(task => task()));
    if (!watch) {
      resetTracking();
    }
  };

  const unmount = () => {
    for (const inst of instances.values()) {
      inst.destroy();
    }
    instances.clear();
  };

  return {
    addFile,
    mount,
    unmount
  };
}