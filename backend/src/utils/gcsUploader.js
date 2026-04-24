// utils/gcsUploader.js

const { Storage } = require("@google-cloud/storage");

const storage = new Storage({
  keyFilename: process.env.GCS_KEY_FILE, // service-account.json
});

async function uploadToGCS(localPath, destination) {
  const bucketName = process.env.GCS_BUCKET;
  const bucket = storage.bucket(bucketName);


  await bucket.upload(localPath, {
    destination: destination,
  });

  const file = bucket.file(destination);
  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return signedUrl;
}

async function uploadBufferToGCS(buffer, destination, mimetype) {
  const bucketName = process.env.GCS_BUCKET;
  const bucket = storage.bucket(bucketName);
    const file = bucket.file(destination);

    await file.save(buffer, {
        metadata: { contentType: mimetype },
        resumable: false
    });

    // Option B: Generate a signed URL (valid for 1 year) if the bucket is private
    const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
    });

    return url;
}

module.exports = { uploadToGCS,uploadBufferToGCS };