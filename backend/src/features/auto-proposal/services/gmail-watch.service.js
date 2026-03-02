const gmailWatchRepository = require("../repositories/gmail-watch.repository");

class GmailWatchService {

  async initializeWatch(data) {
    const existing = await gmailWatchRepository.findByUserIdentity(
      data.user_identities_id
    );

    if (existing) {
      return gmailWatchRepository.updateHistory(data);
    }

    return gmailWatchRepository.create(data);
  }


  async getLastHistoryId(userIdentityId) {
    const record = await gmailWatchRepository.findByUserIdentity(
      userIdentityId
    );

    return record?.history_id || null;
  }


  async updateHistoryId(userIdentityId, historyId) {
    return gmailWatchRepository.updateHistory({
      user_identities_id: userIdentityId,
      history_id: historyId,
      expiration: null
    });
  }


  async isWatchExpired(userIdentityId) {
    const record = await gmailWatchRepository.findByUserIdentity(
      userIdentityId
    );

    if (!record?.expiration) return true;

    return Date.now() > Number(record.expiration);
  }

}

module.exports = new GmailWatchService();