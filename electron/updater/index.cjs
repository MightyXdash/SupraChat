"use strict"

const { UpdateService } = require("./update-service.cjs")

function createUpdateService() {
  return new UpdateService()
}

module.exports = {
  createUpdateService,
}
