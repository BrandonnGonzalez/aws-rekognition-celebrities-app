# AWS Rekognition Celebrities App

Event-driven celebrity recognition: upload an image to S3 → Lambda runs → Amazon Rekognition identifies who is in the photo.

**Your bucket:** `s3://aws-s3-rekognition-celebrities-app-bucket`  
**Test image:** `lebronJames.png`

---

## How it works

```
You upload image → S3 bucket → S3 event notification → Lambda → Rekognition → CloudWatch Logs
```

1. You upload a photo (via AWS Console).
2. S3 sends an **ObjectCreated** event to Lambda.
3. Lambda calls **`RecognizeCelebrities`** with the bucket name and object key.
4. Rekognition reads the image from S3 and returns celebrity matches.
5. Lambda logs the results to **CloudWatch Logs**.

Rekognition reads the file directly from S3 — the image bytes never pass through Lambda.

---

## Project structure

```
aws-rekognition-celebrities-app/
├── src/
│   └── handler.js              # Lambda function (Node.js)
├── events/
│   └── s3-upload-event.json    # Sample S3 event for testing in Console
├── iam/
│   ├── lambda-trust-policy.json
│   └── lambda-permissions-policy.json
├── scripts/
│   ├── build-zip.sh            # Creates dist/lambda.zip for upload
│   └── test-local.js           # Optional local test (needs AWS creds)
└── README.md
```

---

## Prerequisites

- AWS account with access to **S3**, **Lambda**, **Rekognition**, and **IAM**
- S3 bucket already created: `aws-s3-rekognition-celebrities-app-bucket`
- All resources in the **same AWS region** (check your bucket region in the S3 console)

> **Region matters:** Lambda, S3, and Rekognition must be in the same region. Note your bucket's region before creating Lambda.

---

## Step 1 — Build the Lambda deployment package

From this project folder:

```bash
chmod +x scripts/build-zip.sh
npm run build
```

This creates **`dist/lambda.zip`**. You will upload this zip when creating the Lambda function.

The handler uses `@aws-sdk/client-rekognition`, which is **included in the Node.js 20 Lambda runtime** — no extra dependencies to install.

---

## Step 2 — Create the IAM role for Lambda

### 2a. Create the role

1. Open [IAM Console → Roles](https://console.aws.amazon.com/iam/home#/roles)
2. Click **Create role**
3. **Trusted entity type:** AWS service
4. **Use case:** Lambda → **Next**
5. Skip adding managed policies for now → **Next**
6. **Role name:** `rekognition-celebrities-lambda-role`
7. Click **Create role**

### 2b. Attach the permissions policy

1. Open the role you just created
2. **Permissions** tab → **Add permissions** → **Create inline policy**
3. Click **JSON** and paste the contents of `iam/lambda-permissions-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadUploadedImages",
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::aws-s3-rekognition-celebrities-app-bucket/*"
    },
    {
      "Sid": "CallRekognition",
      "Effect": "Allow",
      "Action": ["rekognition:RecognizeCelebrities"],
      "Resource": "*"
    },
    {
      "Sid": "WriteLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

4. **Next** → Policy name: `rekognition-celebrities-lambda-policy` → **Create policy**

This role allows Lambda to:
- Read objects from your bucket
- Call Rekognition
- Write logs to CloudWatch

---

## Step 3 — Create the Lambda function

1. Open [Lambda Console](https://console.aws.amazon.com/lambda) in the **same region as your S3 bucket**
2. **Create function**
3. Settings:
   - **Author from scratch**
   - **Function name:** `recognize-celebrities-on-upload`
   - **Runtime:** Node.js 20.x
   - **Architecture:** x86_64
   - **Execution role:** Use an existing role → select `rekognition-celebrities-lambda-role`
4. Click **Create function**

### 3a. Upload the code

1. In the function page, **Code** tab
2. **Upload from** → **.zip file**
3. Select `dist/lambda.zip` from this project
4. Click **Save**

### 3b. Set the handler

Under **Runtime settings** → **Edit**:
- **Handler:** `handler.handler`

(The zip contains `handler.js` at the root, and `exports.handler` is the entry point.)

### 3c. Configure timeout

Under **Configuration** → **General configuration** → **Edit**:
- **Timeout:** 30 seconds
- **Memory:** 128 MB

Click **Save**.

---

## Step 4 — Test Lambda manually (before wiring S3)

Test with your existing `lebronJames.png` **before** connecting S3 events.

1. Lambda function → **Test** tab
2. **Create new event**
   - **Event name:** `s3-lebron-test`
   - **Event JSON:** paste contents of `events/s3-upload-event.json`
3. Click **Test**

### Expected result

- **Execution result:** Succeeded
- In **Logs**, you should see something like:

```json
{
  "bucket": "aws-s3-rekognition-celebrities-app-bucket",
  "key": "lebronJames.png",
  "celebrityCount": 1,
  "celebrities": [
    {
      "name": "LeBron James",
      "confidence": 99.xx,
      "urls": ["..."],
      "boundingBox": { ... }
    }
  ],
  "unrecognizedFaceCount": 0
}
```

### If the test fails

| Error | Fix |
|-------|-----|
| `AccessDenied` on S3 | Check IAM role has `s3:GetObject` on your bucket |
| `AccessDenied` on Rekognition | Check IAM role has `rekognition:RecognizeCelebrities` |
| `InvalidS3ObjectException` | Confirm `lebronJames.png` exists in the bucket and key spelling matches exactly |
| Wrong region | Move Lambda to the same region as the bucket |

---

## Step 5 — Connect S3 to Lambda (event trigger)

Once the manual test works, wire S3 so **future uploads** automatically trigger Lambda.

1. Open [S3 Console](https://console.aws.amazon.com/s3) → your bucket `aws-s3-rekognition-celebrities-app-bucket`
2. **Properties** tab → scroll to **Event notifications** → **Create event notification**
3. Settings:
   - **Event name:** `trigger-celebrity-recognition`
   - **Prefix** (optional): leave blank to trigger on any upload, or use `uploads/` if you want a subfolder
   - **Suffix** (optional): `.png` or `.jpg` to limit to images
   - **Event types:** check **All object create events**
   - **Destination:** Lambda function → `recognize-celebrities-on-upload`
4. Click **Save changes**

AWS will automatically add permission for S3 to invoke your Lambda.

> **Note:** S3 events only fire for **new uploads**. Your existing `lebronJames.png` will **not** re-trigger unless you upload it again (re-upload or copy in Console).

---

## Step 6 — End-to-end test via Console upload

1. S3 → your bucket → **Upload**
2. Add a celebrity photo (e.g. re-upload `lebronJames.png` or try another image)
3. Lambda → `recognize-celebrities-on-upload` → **Monitor** → **View CloudWatch logs**
4. Open the latest log stream and find the Rekognition result JSON

You should see the same structured output as the manual test.

---

## What the Lambda code does

See `src/handler.js`:

1. Loops over `event.Records` (S3 can batch multiple objects)
2. Extracts `bucket` and `key` from each record
3. URL-decodes the key (handles spaces and `+` in filenames)
4. Calls `RecognizeCelebrities` with `Image.S3Object`
5. Maps results to a clean JSON structure and logs it

---

## Tips

- **Same region:** Bucket, Lambda, and Rekognition must match.
- **Avoid trigger loops:** Do not write Lambda output back to the same bucket path that triggers the function.
- **Supported formats:** JPEG and PNG work best.
- **Who gets recognized:** Rekognition's celebrity model knows public figures (actors, athletes, politicians). It will not identify random people.
- **Costs:** Light personal use is usually very cheap. Rekognition charges per image analyzed.

---

## Optional: test from your terminal

If you have AWS CLI configured locally:

```bash
npm run test:local
```

This invokes the handler against the sample event and calls real AWS APIs.

Re-upload to trigger the live pipeline:

```bash
aws s3 cp ./lebronJames.png s3://aws-s3-rekognition-celebrities-app-bucket/lebronJames.png
```

---

## Next steps (optional extensions)

- Save results to **DynamoDB** instead of only logging
- Send an **SNS email** when a celebrity is detected
- Add an **`uploads/`** prefix to keep the bucket organized
- Add a simple web UI with presigned S3 upload URLs

---

## Quick checklist

- [ ] Built `dist/lambda.zip` (`npm run build`)
- [ ] Created IAM role `rekognition-celebrities-lambda-role`
- [ ] Created Lambda `recognize-celebrities-on-upload` (Node.js 20.x)
- [ ] Manual test with `events/s3-upload-event.json` succeeded
- [ ] S3 event notification connected to Lambda
- [ ] Re-uploaded an image and verified CloudWatch logs
