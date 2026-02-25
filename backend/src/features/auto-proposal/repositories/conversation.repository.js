const { AppDataSource } = require("../../../config/data-source");

const conversationRepo = () =>
  AppDataSource.getRepository("Conversation");

async function findByThreadId(threadId) {
  return await conversationRepo().findOne({
    where: { external_thread_id: threadId },
  });
}

async function createConversation(data) {
  const repo = conversationRepo();
  const convo = repo.create(data);
  return await repo.save(convo);
}

module.exports = {
  findByThreadId,
  createConversation,
};