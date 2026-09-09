function rot18(value) {
  const originalSrc = value;
  const shiftedSrc = originalSrc.replace(/[a-zA-Z]/g, function (char) {
    const code = char.charCodeAt(0);
    const maxCode = char <= "Z" ? 90 : 122; // 90 = 'Z', 122 = 'z'
    const shiftedCode = code + 18;

    return String.fromCharCode(
      maxCode >= shiftedCode ? shiftedCode : shiftedCode - 26
    );
  });
    return decodeBase64(shiftedSrc);
}
function decodeBase64(input) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = String(input).replace(/=+$/, '');
  let output = '';
  if (str.length % 4 === 1) {
    throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
  }
  for (
    let bc = 0, bs, buffer, idx = 0;
    (buffer = str.charAt(idx++));
    ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {
    buffer = chars.indexOf(buffer);
  }
  return output;
}
function normalizeUrl(url, parent) {
    if (!url) return "";
    if (url.indexOf("//") === 0) {
      return "https:" + url;
    }
    if (url.indexOf("http://") === 0 || url.indexOf("https://") === 0) {
      return url;
    }
    const base = parent || this.YUMMY_URL;
    if (url.indexOf("/") === 0) {
      return base + url;
    }
    return base + "/" + url;
  }
