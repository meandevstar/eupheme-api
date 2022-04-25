import AWS from 'aws-sdk';
import { ReadStream } from 'fs';
import config from 'common/config';

export async function getFolderInfo(folderName: string): Promise<AWS.S3.ObjectList> {
  const s3 = getValidS3();
  let allKeys: AWS.S3.ObjectList = [];

  function listAllKeys(token?: string) {
    return new Promise<void>((resolve, reject) => {
      const opts: AWS.S3.ListObjectsRequest & AWS.S3.ListObjectsV2Output = {
        Bucket: config.s3Bucket,
        Prefix: folderName,
      };
      if (token) {
        opts.ContinuationToken = token;
      }

      s3.listObjectsV2(opts, (err, data) => {
        if (err) {
          return reject(err);
        }
        allKeys = allKeys.concat(data.Contents);

        if (data.IsTruncated) {
          listAllKeys(data.NextContinuationToken);
        } else {
          resolve();
        }
      });
    });
  }

  await listAllKeys();

  return allKeys;
}

export async function uploadFile(
  buf: Buffer | ReadStream,
  contentType: string,
  path: string,
  isPrivate?: boolean
): Promise<string> {
  try {
    const s3 = getValidS3();
    const params = {
      Bucket: isPrivate ? config.s3PrivateBucket : config.s3PublicBucket,
      Key: path,
      Body: buf,
      ACL: !isPrivate ? 'public-read' : undefined,
      ContentType: contentType,
    };

    await s3.upload(params).promise();
    const fullPath = `${config.mediaHost}/${isPrivate ? 'private/' : ''}${path}`;

    return fullPath;
  } catch (err) {
    throw err;
  }
}

export function deleteFile(path: string): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    try {
      const s3 = getValidS3();
      const params: AWS.S3.DeleteObjectRequest = {
        Bucket: config.s3Bucket,
        Key: path,
      };
      s3.deleteObject(params, (err, data) => {
        console.log('==> delete file', data);
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

export function getValidS3() {
  const awsConfig = new AWS.Config({
    accessKeyId: config.awsAccessKeyId,
    secretAccessKey: config.awsSecretAccessKey,
    region: config.awsRegion,
  });

  return new AWS.S3(awsConfig);
}
