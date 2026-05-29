/**
 * Optional local smoke test — requires AWS credentials and the image in S3.
 * Usage: node scripts/test-local.js
 */
const { handler } = require("../src/handler");
const event = require("../events/s3-upload-event.json");

handler(event)
  .then((result) => {
    console.log("Lambda returned:", result);
  })
  .catch((err) => {
    console.error("Lambda failed:", err);
    process.exit(1);
  });
