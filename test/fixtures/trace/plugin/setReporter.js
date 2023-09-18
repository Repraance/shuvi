import { setReporter } from '@shuvi/service/lib/trace';

window._reporterData = [];
window._getReporterData = () => window._reporterData;
window._clearReporterData = () => {
  window._reporterData = [];
};

setReporter(data => {
  console.log('---------', data.name);
  window._reporterData.push(data);
});
