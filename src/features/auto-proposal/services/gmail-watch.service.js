const gmailWatchRepository = require("../repositories/gmail-watch.repository");

class GmailWatchService {

  async initializeWatch(data) {
  
    const existing = await gmailWatchRepository.findByUserIdentity(
      data.user_identities_id,
      data.tenant_id
    );

    if (existing) {
      return gmailWatchRepository.updateHistory(data);
    }

    return gmailWatchRepository.create(data);
  }


  async getLastHistoryId(userIdentityId, tenantId) {
    const record = await gmailWatchRepository.findByUserIdentity(
      userIdentityId,
      tenantId
    );

    return record?.history_id || null;
  }


  async updateHistoryId(userIdentityId, historyId, tenantId) {
    return gmailWatchRepository.updateHistory({
      user_identities_id: userIdentityId,
      history_id: historyId,
      expiration: null,
      tenant_id: tenantId
    });
  }


  async isWatchExpired(userIdentityId, tenantId) {
    const record = await gmailWatchRepository.findByUserIdentity(
      userIdentityId,
      tenantId
    );

    if (!record?.expiration) return true;

    return Date.now() > Number(record.expiration);
  }

}

module.exports = new GmailWatchService();