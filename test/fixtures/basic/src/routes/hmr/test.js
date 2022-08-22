const path = require('path');
const fs = require('fs');
function wait(timeout) {
  return new Promise(resolve => setTimeout(resolve, timeout));
}

const routePath = path.resolve(__dirname, 'one');
const newRoutePath = path.resolve(__dirname, 'new-one');

const change = async () => {
  fs.renameSync(routePath, newRoutePath);
  console.log('changed to new-route');
  await wait(1000);
  fs.renameSync(newRoutePath, routePath);
  console.log('changed to route');
  await wait(1000);
};

const run = async () => {
  for (let i = 0; i < 330; i++) {
    await change();
  }
};

run();
