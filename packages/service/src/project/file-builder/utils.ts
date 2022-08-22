import { TimeInfo } from './types';
export const uuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const ifIntersect = <T>(setA: ReadonlySet<T>, setB: ReadonlySet<T>) => {
  for (const ele of setA) {
    if (setB.has(ele)) {
      return true;
    }
  }
  return false;
};

export const includesAll = <T>(
  bigger: ReadonlySet<T>,
  smaller: ReadonlySet<T>
) => {
  for (const ele of smaller) {
    if (!bigger.has(ele)) {
      return false;
    }
  }
  return true;
};

const isInfoSame = (info1: TimeInfo, info2: TimeInfo) => {
  if (info1.safeTime && info2.safeTime) {
    return info1.safeTime === info2.safeTime;
  }
  return true;
};

export const isInfoEntriesSame = (
  bigger: ReadonlyMap<string, TimeInfo>,
  smaller: ReadonlyMap<string, TimeInfo>
): boolean => {
  for (const [file, info] of smaller) {
    const biggerInfo = bigger.get(file);
    if (!(biggerInfo && isInfoSame(biggerInfo, info))) {
      console.log('========not same', file, biggerInfo, info);
      return false;
    }
  }
  return true;
};
