/** Convert scanner data into the same encrypted-file workflow as photo uploads. */
export function portraitFileFromBase64(value: string): File {
  const match = /^data:image\/(jpeg|jpg|png|webp|gif);base64,([\s\S]+)$/i.exec(value);
  const encoded = (match ? match[2] : value).replace(/\s/g, '');
  if (encoded.length > 7 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error('Invalid portrait data');
  }
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error('Portrait exceeds 5MB');
  let ext: string;
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) ext = 'jpeg';
  else if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ext = 'png';
  else if (/^GIF8[79]a$/.test(bytes.subarray(0, 6).toString())) ext = 'gif';
  else if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') ext = 'webp';
  else throw new Error('Unsupported portrait format');
  return new File([bytes], `cccd-portrait.${ext}`, { type: `image/${ext}` });
}
