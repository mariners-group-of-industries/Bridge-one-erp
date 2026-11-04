import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ObjectStorage } from "./index";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string;
}

/** Reads Cloudflare R2 credentials from environment variables with configured fallback. */
export function r2ConfigFromEnv(env: NodeJS.ProcessEnv = process.env): R2Config | null {
  const accountId = env.R2_ACCOUNT_ID || "a1c55545bd46d457d5e2faf66822f06f";
  const accessKeyId = env.R2_ACCESS_KEY_ID || "0e92967a0d7afec61e5d43a691bdd94a";
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY || "a3ced80b2214817e6174b1871656c51abe1e152b90c9162813c5c83fef7c1876";
  const bucketName = env.R2_BUCKET_NAME || "bridgeone-connect";
  const publicUrl = env.R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicUrl,
  };
}

/**
 * Cloudflare R2 (S3-compatible) Object Storage Driver.
 * 10 GB Free Storage, Zero Egress / Bandwidth Fees ($0).
 */
export class R2Storage implements ObjectStorage {
  public readonly client: S3Client;
  public readonly bucket: string;
  public readonly publicUrl?: string;

  constructor(config: R2Config) {
    this.bucket = config.bucketName;
    this.publicUrl = config.publicUrl?.replace(/\/+$/, "");
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async put(key: string, data: Uint8Array, contentType?: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType || "application/octet-stream",
      })
    );

    if (this.publicUrl) {
      return `${this.publicUrl}/${key}`;
    }
    return `/api/storage/${key}`;
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
      if (!response.Body) return null;
      return await response.Body.transformToByteArray();
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
    } catch {
      // Ignored
    }
  }

  /**
   * Generates a pre-signed URL allowing client-side direct uploads to Cloudflare R2.
   * Completely bypasses Next.js server memory and bandwidth constraints.
   */
  async getPresignedUploadUrl(key: string, contentType: string, expiresInSec = 300): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return await getSignedUrl(this.client, command, { expiresIn: expiresInSec });
  }
}
