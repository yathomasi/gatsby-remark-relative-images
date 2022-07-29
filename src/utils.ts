import fetch from "node-fetch";

export const slash = (path: string): string => {
  const isExtendedLengthPath = /^\\\\\?\\/.test(path);

  if (isExtendedLengthPath) {
    return path;
  }
  return path.replace(/\\/g, `/`);
};

export const chekcIfExistsOnServer = async (url) => {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch (error) {
    return false;
  }
};
