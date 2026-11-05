const isTauri = window.__TAURI__ !== undefined;
export const getServerUrl = () => localStorage.getItem('flyte_server_url') || "";
export const setServerUrl = (url) => {
  if (url) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    url = url.replace(/\/+$/, '');
    localStorage.setItem('flyte_server_url', url);
  } else {
    localStorage.removeItem('flyte_server_url');
  }
};
const getToken = () => localStorage.getItem('flyte_token') || localStorage.getItem('mycloud_token') || "";

export async function listDirectory(path) {
  const token = getToken();
  if (isTauri) {
    const { invoke } = window.__TAURI__.tauri;
    return await invoke('list_directory', { token, path });
  } else {
    const res = await fetch(`${getServerUrl()}/api/list?path=${encodeURIComponent(path)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }
}

export async function createFolder(path) {
  const token = getToken();
  if (isTauri) {
    const { invoke } = window.__TAURI__.tauri;
    return await invoke('create_folder', { token, path });
  } else {
    const res = await fetch(`${getServerUrl()}/api/create_folder`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ path })
    });
    if (!res.ok) throw new Error(await res.text());
  }
}

export async function deleteItem(path) {
  const token = getToken();
  if (isTauri) {
    const { invoke } = window.__TAURI__.tauri;
    return await invoke('delete_item', { token, path });
  } else {
    const res = await fetch(`${getServerUrl()}/api/delete`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ path })
    });
    if (!res.ok) throw new Error(await res.text());
  }
}

export async function openFile(id, name) {
  const token = getToken();
  if (isTauri) {
    const { invoke } = window.__TAURI__.tauri;
    return await invoke('open_file', { token, id, name });
  } else {
    const res = await fetch(`${getServerUrl()}/api/download?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}

export async function uploadPhysicalFile(sourcePath, fileObj, fileName, parentPath) {
  const token = getToken();
  if (isTauri) {
    const { invoke } = window.__TAURI__.tauri;
    return await invoke('upload_physical_file', {
      token,
      sourcePath,
      fileName,
      parentPath
    });
  } else {
    const formData = new FormData();
    formData.append('parentPath', parentPath);
    formData.append('file', fileObj, fileName);
    const res = await fetch(`${getServerUrl()}/api/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    if (!res.ok) throw new Error(await res.text());
  }
}
