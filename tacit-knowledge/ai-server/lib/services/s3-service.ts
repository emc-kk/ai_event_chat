import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { config } from '../config'

let s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (!s3Client) {
    const clientConfig: { region: string; credentials?: { accessKeyId: string; secretAccessKey: string } } = {
      region: config.s3.region,
    }

    if (config.s3.accessKeyId && config.s3.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      }
    }

    s3Client = new S3Client(clientConfig)
  }
  return s3Client
}

export async function downloadFromS3(key: string): Promise<string> {
  const client = getS3Client()

  const command = new GetObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
  })

  const response = await client.send(command)

  if (!response.Body) {
    throw new Error(`Empty response body for key: ${key}`)
  }

  const bodyContents = await response.Body.transformToString()
  return bodyContents
}

export interface UploadFileParams {
  roomId: string
  fileName: string
  contentType: string
  data: Buffer
}

export interface UploadResult {
  filePath: string
  fileName: string
  contentType: string
  fileSize: number
}

export async function uploadToS3(params: UploadFileParams): Promise<UploadResult> {
  const client = getS3Client()

  const timestamp = Date.now()
  const filePath = `rooms/${params.roomId}/uploads/${timestamp}/${params.fileName}`

  const command = new PutObjectCommand({
    Bucket: config.s3.bucket,
    Key: filePath,
    Body: params.data,
    ContentType: params.contentType,
  })

  await client.send(command)

  return {
    filePath,
    fileName: params.fileName,
    contentType: params.contentType,
    fileSize: params.data.length,
  }
}

