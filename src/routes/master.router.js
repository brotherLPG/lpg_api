const express = require('express');
const { authenticate } = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');

function createMasterRouter({ moduleName, controller, schemas, allowDelete = true }) {
  const router = express.Router();
  router.use(authenticate);

  router.post('/', authorize(`${moduleName}.create`), validate(schemas.create), controller.create);
  router.get('/', authorize(`${moduleName}.read`), validate(schemas.list), controller.list);
  router.get('/:id', authorize(`${moduleName}.read`), validate(schemas.idParam), controller.get);
  router.patch('/:id', authorize(`${moduleName}.update`), validate(schemas.update), controller.update);

  if (allowDelete) {
    router.delete('/:id', authorize(`${moduleName}.delete`), validate(schemas.idParam), controller.remove);
  }

  return router;
}

module.exports = { createMasterRouter };
