export function getFileIcon(type: string): string {
  switch (type) {
    case 'py':
      return 'fas fa-file-code';
    case 'txt':
      return 'fas fa-file-alt';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
      return 'fas fa-image';
    default:
      return 'fas fa-file';
  }
}

export function getFileIconColor(type: string): string {
  switch (type) {
    case 'py':
      return 'text-blue-500';
    case 'txt':
      return 'text-gray-500';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
      return 'text-green-500';
    default:
      return 'text-gray-400';
  }
}

export function isImageFile(type: string): boolean {
  return ['png', 'jpg', 'jpeg', 'webp'].includes(type);
}

export function isPythonFile(type: string): boolean {
  return type === 'py';
}

export function isTextFile(type: string): boolean {
  return type === 'txt';
}

export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
