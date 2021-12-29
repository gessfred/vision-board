export function lsImages(folderId, consumeFiles) {
  window.gapi.client.drive.files.list({
    q: `(mimeType = 'image/png' or mimeType = 'image/jpeg') and '${folderId}' in parents`
  }).then(r => {
    consumeFiles(r.result.files)
  })
}

export function ls(callback) {
  window.gapi.client.drive.files.list({
    q: "mimeType = 'application/vnd.google-apps.folder'"
  }).then(r => {
    callback(r.result.files)
  })
}


export function getImage(fileId, consumeImage) {
  window.gapi.client.drive.files.get({
    fileId: fileId,
    alt: 'media'
  }).then(res => consumeImage(`data:${res.headers["Content-Type"]};base64,${btoa(res.body)}`))
}

//To remove


function listFiles() {
  window.gapi.client.request('/drive/v3/files').execute(r => {
    console.log(r)
  })
}

function listDrives(callback) {
  if(!window.gapi) return
  window.gapi.client.request('/drive/v3/drives').execute(r => {
    
  })
}

function previewFolder(source, callback) {

}
