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
