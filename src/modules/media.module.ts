import pick from 'lodash/pick';
import jimp, { MIME_PNG } from 'jimp';
import { IAppContext, IQueryPayload } from 'common/types';
import { uploadFile } from 'modules/lib/s3.module';
import { IMedia, IMediaType, IMediaUploadPayload } from 'models/types';

export async function uploadProfileMedia(context: IAppContext, payload: IMediaUploadPayload) {
  const {
    user,
    conn: { Media },
  } = context;
  const { file, name, description, public: isPublic } = payload;
  const mediaPayload: IMedia = {
    name,
    description,
    creator: user.id,
    private: !isPublic,
  };

  // generate private file
  mediaPayload.type = file.mimetype.split('/')[0] as IMediaType;
  const dirName = `${mediaPayload.type}s`;
  let jimpFile = await jimp.read(file.filepath);
  console.log('jimpFile', jimpFile);
  const originalBuf = await jimpFile.getBufferAsync(MIME_PNG);

  const fileName = `file_${Date.now()}`;
  mediaPayload.file = await uploadFile(
    originalBuf,
    file.mimetype,
    `${dirName}/${fileName}`,
    !isPublic
  );

  const resizeRatio = 300 / jimpFile.getWidth();
  jimpFile = jimpFile.scale(resizeRatio);
  const thumbnailBuf = await jimpFile.getBufferAsync(MIME_PNG);
  mediaPayload.thumbnail = await uploadFile(
    thumbnailBuf,
    file.mimetype,
    `${dirName}/thb_${fileName}`
  );

  if (isPublic) {
    // generate blurred file
    const blurredBuf = await jimpFile.blur(8).getBufferAsync(MIME_PNG);
    mediaPayload.blurred = await uploadFile(
      blurredBuf,
      file.mimetype,
      `${dirName}/blr_${fileName}`
    );
  }

  const media = await new Media(mediaPayload).save();

  return media.beautify();
}

export async function getProfileMedias(context: IAppContext, payload: IQueryPayload) {
  const {
    user,
    conn: { Media },
  } = context;
  const { query, sort, pagination } = payload;
  const mediaQuery: any = {};
  // just pass query for now
  Object.assign(mediaQuery, pick(query, ['target', 'type']));
  mediaQuery['creator'] = user.id;

  const countAction = Media.find(mediaQuery).countDocuments();
  let queryAction = Media.find(mediaQuery);
  if (sort) {
    queryAction = queryAction.sort(sort);
  }
  if (pagination) {
    queryAction = queryAction.skip(pagination.offset * pagination.limit).limit(pagination.limit);
  }

  const [total, medias] = await Promise.all([
    countAction,
    queryAction.select('name description thumbnail blurred').lean({ virtuals: true }),
  ]);

  // check user plan and restrict image access
  return { total, data: medias };
}

export async function uploadPrivateVideos(context: IAppContext, payload: IMediaUploadPayload) {
  const {
    user,
    conn: { Media },
  } = context;
  const { file, name, description, public: isPublic } = payload;
  const mediaPayload: IMedia = {
    name,
    description,
    creator: user.id,
    private: !isPublic,
  };

  // generate private file
  mediaPayload.type = file.mimetype.split('/')[0] as IMediaType;
  const dirName = `${mediaPayload.type}s`;
  // let jimpFile = await jimp.read(file.filepath);
  // console.log('jimpFile', jimpFile);
  // const originalBuf = await jimpFile.getBufferAsync(MIME_PNG);

  const fileName = `file_${Date.now()}`;
  mediaPayload.file = await uploadFile(
    // originalBuf,
    Buffer.from(file.filepath),
    file.mimetype,
    `${dirName}/${fileName}`,
    !isPublic
  );
  // if (isPublic) {
  //   // generate blurred file
  //   const blurredBuf = await jimpFile.blur(8).getBufferAsync(MIME_PNG);
  //   mediaPayload.blurred = await uploadFile(
  //     blurredBuf,
  //     file.mimetype,
  //     `${dirName}/blr_${fileName}`
  //   );
  // }

  const media = await new Media(mediaPayload).save();

  return media.beautify();
}
