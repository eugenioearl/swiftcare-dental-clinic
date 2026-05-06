
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createS3Client, getBucketConfig } from './aws-config'

const s3Client = createS3Client()
const { bucketName, folderPrefix } = getBucketConfig()

export async function uploadFile(buffer: Buffer, fileName: string): Promise<string> {
  const key = `${folderPrefix}uploads/${Date.now()}-${fileName}`
  
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
  })
  
  await s3Client.send(command)
  return key // This is the cloud_storage_path
}

export async function downloadFile(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  })
  
  // Generate a signed URL for download (expires in 1 hour)
  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
  return signedUrl
}

export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  })
  
  await s3Client.send(command)
}

export async function renameFile(oldKey: string, newKey: string): Promise<string> {
  // S3 doesn't have a rename operation, so we copy and delete
  const copyCommand = new CopyObjectCommand({
    Bucket: bucketName,
    Key: newKey,
    CopySource: `${bucketName}/${oldKey}`,
  })
  
  await s3Client.send(copyCommand)
  await deleteFile(oldKey)
  
  return newKey
}
