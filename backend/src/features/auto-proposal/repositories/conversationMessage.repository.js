const { AppDataSource } = require("../../../config/data-source");

const messageRepo = () =>
  AppDataSource.getRepository("ConversationMessage");

async function createMessage(data) {
  const repo = messageRepo();
  const msg = repo.create(data);
  return await repo.save(msg);
}

module.exports = { createMessage };