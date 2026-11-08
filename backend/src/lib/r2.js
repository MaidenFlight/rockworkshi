// Cloudflare R2 speaks the S3 API, so the AWS SDK works against it with a custom endpoint.
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const REQUIRED = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"];

function isR2Configured() {
  return REQUIRED.every((name) => Boolean(process.env[name]));
}

// Created on first use so the API still boots in dev without R2 keys.
let client;
function r2() {
  if (!isR2Configured()) {
    throw new Error(`R2 is not configured. Set ${REQUIRED.join(", ")} in .env.`);
  }
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
      // Newer SDKs add checksums R2 doesn't need; only send them when an operation requires it.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return client;
}

async function putObject(key, body, contentType) {
  await r2().send(
    new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, Body: body, ContentType: contentType })
  );
}

// The bucket is private. Members get a link that stops working after expiresIn seconds.
function signedUrl(key, expiresIn = 60 * 60) {
  return getSignedUrl(r2(), new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }), { expiresIn });
}

// A link the app can PUT one file to. Type and size are part of the signature,
// so the upload is rejected unless it sends exactly those.
function signedUploadUrl(key, contentType, contentLength, expiresIn = 10 * 60) {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });
  return getSignedUrl(r2(), command, {
    expiresIn,
    signableHeaders: new Set(["content-type", "content-length"]),
  });
}

// { size, contentType }, or null if there's no such object.
async function headObject(key) {
  try {
    const out = await r2().send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
    return { size: out.ContentLength, contentType: out.ContentType };
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

// Every object under a prefix, as { key, lastModified }.
async function listObjects(prefix) {
  const objects = [];
  let ContinuationToken;
  do {
    const out = await r2().send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET, Prefix: prefix, ContinuationToken }));
    for (const o of out.Contents || []) objects.push({ key: o.Key, lastModified: o.LastModified });
    ContinuationToken = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return objects;
}

async function deleteObject(key) {
  await r2().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
}

// A large file goes up in pieces, so a dropped connection only costs the piece it was on.
async function createMultipartUpload(key, contentType) {
  const out = await r2().send(new CreateMultipartUploadCommand({ Bucket: process.env.R2_BUCKET, Key: key, ContentType: contentType }));
  return out.UploadId;
}

async function uploadPart(key, uploadId, partNumber, body) {
  await r2().send(new UploadPartCommand({ Bucket: process.env.R2_BUCKET, Key: key, UploadId: uploadId, PartNumber: partNumber, Body: body }));
}

// The pieces that have arrived, as [{ partNumber, etag, size }] in order. [] once the upload is gone.
async function listParts(key, uploadId) {
  const parts = [];
  let PartNumberMarker;
  try {
    do {
      const out = await r2().send(new ListPartsCommand({ Bucket: process.env.R2_BUCKET, Key: key, UploadId: uploadId, PartNumberMarker }));
      for (const p of out.Parts || []) parts.push({ partNumber: p.PartNumber, etag: p.ETag, size: p.Size });
      PartNumberMarker = out.IsTruncated ? out.NextPartNumberMarker : undefined;
    } while (PartNumberMarker);
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 404) return [];
    throw err;
  }
  return parts;
}

async function completeMultipartUpload(key, uploadId, parts) {
  await r2().send(
    new CompleteMultipartUploadCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })) },
    })
  );
}

async function abortMultipartUpload(key, uploadId) {
  await r2().send(new AbortMultipartUploadCommand({ Bucket: process.env.R2_BUCKET, Key: key, UploadId: uploadId }));
}

module.exports = {
  isR2Configured,
  putObject,
  signedUrl,
  signedUploadUrl,
  headObject,
  listObjects,
  deleteObject,
  createMultipartUpload,
  uploadPart,
  listParts,
  completeMultipartUpload,
  abortMultipartUpload,
};
