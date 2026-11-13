/** Azure Blob SAS uploads require a blob type; S3 uploads must not receive Azure headers. */
export const setStorageUploadHeaders = (xhr: XMLHttpRequest, uploadUrl: string, file: File): void => {
  xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

  const params = new URL(uploadUrl).searchParams;
  if (params.get('sr') === 'b' && params.has('sv') && params.has('sig')) {
    xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
  }
};
