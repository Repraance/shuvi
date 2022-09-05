import { ShuviApiHandler } from '@shuvi/runtime/server';

const apiHandler: ShuviApiHandler = function handler(req, res) {
  res.status(200).json({ data: 'apis index success' });
};
export default apiHandler;
