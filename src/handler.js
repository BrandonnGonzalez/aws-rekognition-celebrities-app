const {
  RekognitionClient,
  RecognizeCelebritiesCommand,
} = require("@aws-sdk/client-rekognition");

const rekognition = new RekognitionClient({});

/**
 * Triggered by S3 when a new image is uploaded.
 * Calls Rekognition RecognizeCelebrities on the S3 object.
 */
exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(
      record.s3.object.key.replace(/\+/g, " ")
    );

    console.log(`Analyzing s3://${bucket}/${key}`);

    const command = new RecognizeCelebritiesCommand({
      Image: {
        S3Object: {
          Bucket: bucket,
          Name: key,
        },
      },
    });

    const response = await rekognition.send(command);

    const celebrities = (response.CelebrityFaces || []).map((face) => ({
      name: face.Name,
      confidence: Math.round(face.MatchConfidence * 100) / 100,
      urls: face.Urls || [],
      boundingBox: face.Face?.BoundingBox,
    }));

    const result = {
      bucket,
      key,
      celebrityCount: celebrities.length,
      celebrities,
      unrecognizedFaceCount: (response.UnrecognizedFaces || []).length,
    };

    console.log("Rekognition result:", JSON.stringify(result, null, 2));
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Celebrity recognition complete" }),
  };
};
