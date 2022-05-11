import { promisify } from 'util';
import jimp, { MIME_PNG } from 'jimp';
import { IAppContext } from 'common/types';
import { uploadFile } from 'modules/lib/s3.module';
import { IMedia, IMediaUploadPayload } from 'models/types';

export async function uploadProfileMedia(context: IAppContext, payload: IMediaUploadPayload) {
  const {
    user,
    conn: { Media },
  } = context;
  const { file, name, description, isPublic } = payload;
  const mediaPayload: IMedia = {
    name,
    description,
    creator: user.id,
    private: !isPublic,
  };

  // generate private file
  const fileType = file.mimetype.split('/')[0];
  const dirName = `${fileType}s`;

  let jimpFile = await jimp.read(file.filepath);
  const originalBuf = await promisify(jimpFile.getBuffer)(MIME_PNG);

  const fileName = `file_${Date.now()}`;
  mediaPayload.file = await uploadFile(
    originalBuf,
    file.mimetype,
    `${dirName}/${fileName}}`,
    !isPublic
  );

  jimpFile = jimpFile.resize(300, 300);
  const thumbnailBuf = await promisify(jimpFile.getBuffer)(MIME_PNG);
  mediaPayload.thumbnail = await uploadFile(
    thumbnailBuf,
    file.mimetype,
    `${dirName}/thb_${fileName}}`
  );

  if (isPublic) {
    // generate blurred file
    const blurredBuf = await promisify(jimpFile.blur(3).getBuffer)(MIME_PNG);
    mediaPayload.blurred = await uploadFile(
      blurredBuf,
      file.mimetype,
      `${dirName}/blr_${fileName}}`
    );
  }

  const media = await new Media(mediaPayload).save();

  return media.beautify();
}
