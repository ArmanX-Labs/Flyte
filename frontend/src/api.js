export const isTauri = () => {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.__TAURI__ ||
    window.__TAURI_METADATA__ ||
    window.location.protocol === 'tauri:' ||
    window.location.hostname === 'tauri.localhost'
  );
};

export const isCapacitor = () => {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.Capacitor?.isNativePlatform?.() ||
    window.Capacitor !== undefined ||
    window.location.protocol === 'capacitor:' ||
    (window.location.protocol === 'http:' && window.location.hostname === 'localhost' && !isTauri() && (!window.location.port || window.location.port === '80'))
  );
};

export const getServerUrl = () => {
  const custom = localStorage.getItem('flyte_server_url');
  if (custom) return custom;

  if (isTauri()) {
    // In Tauri desktop, Axum server runs locally on port 3000
    return 'http://127.0.0.1:3000';
  }

  // In standard browser visiting the web app (e.g. Docker), relative path works
  return '';
};

export const setServerUrl = (url) => {
  if (url) {
    url = url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      const isLocal = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(url) || url.startsWith('localhost');
      url = (isLocal ? 'http://' : 'https://') + url;
    }
    url = url.replace(/\/+$/, '');
    localStorage.setItem('flyte_server_url', url);
  } else {
    localStorage.removeItem('flyte_server_url');
  }
};

export async function parseApiResponse(res) {
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (err) {
    if (text.trim().startsWith('<') || text.includes('<!DOCTYPE') || text.includes('<!doctype')) {
      const hint = isCapacitor()
        ? 'Could not connect to Flyte backend. Please configure your Server URL below (e.g. http://192.168.1.x:3000 or your hosted server URL).'
        : 'Could not connect to Flyte backend. Please make sure the Flyte server is running.';
      throw new Error(hint);
    }
    throw new Error(text || `Invalid server response (${res.status})`);
  }

  if (!res.ok) {
    const msg = data && (data.error || data.message || (typeof data === 'string' ? data : null));
    throw new Error(msg || text || `Request failed with status ${res.status}`);
  }

  return data;
}

export async function sendAuthCode(phone) {
  if (isTauri()) {
    const { invoke } = window.__TAURI__.tauri;
    return await invoke('auth_send_code', { phone });
  } else {
    const server = getServerUrl();
    const res = await fetch(`${server}/api/auth/send_code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    return await parseApiResponse(res);
  }
}

export async function signIn(phone, code) {
  if (isTauri()) {
    const { invoke } = window.__TAURI__.tauri;
    return await invoke('auth_sign_in', { phone, code });
  } else {
    const server = getServerUrl();
    const res = await fetch(`${server}/api/auth/sign_in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code })
    });
    return await parseApiResponse(res);
  }
}

export async function checkPassword(phone, password) {
  if (isTauri()) {
    const { invoke } = window.__TAURI__.tauri;
    return await invoke('auth_check_password', { phone, password });
  } else {
    const server = getServerUrl();
    const res = await fetch(`${server}/api/auth/check_password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });
    return await parseApiResponse(res);
  }
}

export async function checkAuthStatus(token) {
  if (isTauri()) {
    const { invoke } = window.__TAURI__.tauri;
    return await invoke('auth_status', { token });
  } else {
    const server = getServerUrl();
    const res = await fetch(`${server}/api/auth/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await parseApiResponse(res);
    return Boolean(data.authorized);
  }
}

const getToken = () => localStorage.getItem('flyte_token') || localStorage.getItem('mycloud_token') || '';

export async function listDirectory(path) {
  const token = getToken();
  if (isTauri()) {
    const { invoke } = window.__TAURI__.tauri;
    return await invoke('list_directory', { token, path });
  } else {
    const res = await fetch(`${getServerUrl()}/api/list?path=${encodeURIComponent(path)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return await parseApiResponse(res);
  }
}

export async function createFolder(path) {
  const token = getToken();
  if (isTauri()) {
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
    return await parseApiResponse(res);
  }
}

export async function deleteItem(path) {
  const token = getToken();
  if (isTauri()) {
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
    return await parseApiResponse(res);
  }
}

export async function openFile(id, name) {
  const token = getToken();
  if (isTauri()) {
    const { invoke } = window.__TAURI__.tauri;
    return await invoke('open_file', { token, id, name });
  } else {
    const res = await fetch(`${getServerUrl()}/api/download?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      return await parseApiResponse(res);
    }
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
  if (isTauri()) {
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
    return await parseApiResponse(res);
  }
}
