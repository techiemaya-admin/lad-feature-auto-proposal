// utils/gcsUploader.js

const { Storage } = require("@google-cloud/storage");

const storage = new Storage({
  keyFilename: process.env.GCS_KEY_FILE, // service-account.json
});

async function uploadToGCS(localPath, fileName) {
  const bucketName = process.env.GCS_BUCKET;
  const bucket = storage.bucket(bucketName);
  const destination = `proposals/${fileName}`;

   await bucket.upload(localPath, {
    destination: destination,
  });

  const file = bucket.file(destination);
//   await storage.bucket(bucketName).upload(localPath, {
//     destination: `proposals/${fileName}`,
//   });

//   return `https://storage.googleapis.com/${bucketName}/proposals/${fileName}`;
    const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return signedUrl;
}

module.exports = { uploadToGCS };