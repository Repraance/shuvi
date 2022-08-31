const path = require('path');
const { renameSync } = require('fs');

const sampleFilePath = path.resolve(__dirname, 'src/sample.js');
const newSampleFilePath = path.resolve(__dirname, 'src/new-sample.js');
const routesDirPath = path.resolve(__dirname, 'src/routes');
const _routesDirPath = path.resolve(__dirname, 'src/_routes');
const newRoutesDirPath = path.resolve(__dirname, 'src/new-routes');

const oneDirPath = path.resolve(__dirname, 'src/routes/one');

const twoDirPath = path.resolve(__dirname, 'src/routes/two');
const threeDirPath = path.resolve(__dirname, 'src/routes/three');

const newOneDirPath = path.resolve(__dirname, 'src/routes/new-one');

const onePageFilePath = path.resolve(__dirname, 'src/routes/one/page.js');

const newOnePageFilePath = path.resolve(
  __dirname,
  'src/routes/one/new-page.js'
);

const loopFn = async (time, interval) => {
  console.log('------------ current time ------------', time);
  // change sample file path and change back
  renameSync(sampleFilePath, newSampleFilePath);
  await wait(interval);

  renameSync(newSampleFilePath, sampleFilePath);
  await wait(interval);

  // change one page file path and change back
  renameSync(onePageFilePath, newOnePageFilePath);
  await wait(interval);

  renameSync(newOnePageFilePath, onePageFilePath);
  await wait(interval);

  // change one dir path and change back
  renameSync(oneDirPath, newOneDirPath);
  await wait(interval);

  renameSync(newOneDirPath, oneDirPath);
  await wait(interval);

  // change routes dir path and change back
  renameSync(routesDirPath, newRoutesDirPath);
  await wait(interval);

  renameSync(newRoutesDirPath, routesDirPath);
  await wait(interval);
};

function wait(timeout) {
  return new Promise(resolve => setTimeout(resolve, timeout));
}

const main = async () => {
  const times = 80;
  const interval = 1000;
  console.log('start');

  for (let i = 0; i < times; i++) {
    await loopFn(i + 1, interval);
  }
};

main();
