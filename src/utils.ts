import axios from "axios";
export const slash = (path: string): string => {
  const isExtendedLengthPath = /^\\\\\?\\/.test(path);

  if (isExtendedLengthPath) {
    return path;
  }
  return path.replace(/\\/g, `/`);
};

export const chekcIfExistsOnServer = async (url) => {
  try {
    await axios(url, { method: "HEAD" });
    return true;
  } catch (error) {
    return false;
  }
};
