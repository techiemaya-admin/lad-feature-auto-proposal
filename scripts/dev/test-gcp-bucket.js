// test-gcs.js Just for testing
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Storage } = require('@google-cloud/storage');

async function testGCSConnection() {
  console.log('🔍 Starting Google Cloud Storage verification...\n');

  const keyFilePath = process.env.GCS_KEY_FILE;
  const bucketName = process.env.GCS_BUCKET;

  // 1. Validate Environment Variables
  if (!keyFilePath) {
    console.error('❌ Missing GCS_KEY_FILE in .env');
    return;
  }
  if (!bucketName) {
    console.error('❌ Missing GCS_BUCKET in .env');
    return;
  }

  // 2. Check Key File Existence on Disk
  const resolvedKeyPath = path.resolve(process.cwd(), keyFilePath);
  if (!fs.existsSync(resolvedKeyPath)) {
    console.error(`❌ Key file not found at: ${resolvedKeyPath}`);
    return;
  }
  console.log(`✅ Key file located: ${resolvedKeyPath}`);

  try {
    // 3. Initialize GCS Client
    const storage = new Storage({ keyFilename: resolvedKeyPath });
    const bucket = storage.bucket(bucketName);

    // 4. Check Bucket Existence & Access
    console.log(`📡 Checking bucket "${bucketName}" access...`);
    const [exists] = await bucket.exists();
    if (!exists) {
      console.error(`❌ Bucket "${bucketName}" does not exist or service account has no permission to view it.`);
      return;
    }
    console.log(`✅ Bucket "${bucketName}" exists and is reachable.`);

    // 5. Test File Upload (Write Permission)
    const testFileName = `healthcheck/test-${Date.now()}.txt`;
    const testContent = `GCS healthcheck timestamp: ${new Date().toISOString()}`;
    const file = bucket.file(testFileName);

    console.log(`📤 Testing file upload to "${testFileName}"...`);
    await file.save(Buffer.from(testContent), {
      metadata: { contentType: 'text/plain' },
      resumable: false,
    });
    console.log('✅ File upload successful.');

    // 6. Test Signed URL Generation (SignBlob Permission)
    console.log('🔗 Testing Signed URL generation...');
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    });
    console.log(`✅ Signed URL generated successfully:\n   ${signedUrl.substring(0, 80)}...`);

    // 7. Test File Download / Read (Read Permission)
    console.log('📥 Testing file download...');
    const [downloadedBuffer] = await file.download();
    if (downloadedBuffer.toString() === testContent) {
      console.log('✅ Download content matches uploaded content.');
    } else {
      console.warn('⚠️ Downloaded content did not match uploaded content.');
    }

    // 8. Clean up (Delete Permission)
    console.log('🧹 Cleaning up test file...');
    await file.delete();
    console.log('✅ Test file deleted.');

    console.log('\n🎉 ALL GCS CHECKS PASSED! Storage is working properly.');
  } catch (error) {
    console.error('\n❌ GCS Verification Failed:', error.message);
    if (error.code) console.error(`   Error Code: ${error.code}`);
  }
}

testGCSConnection();
