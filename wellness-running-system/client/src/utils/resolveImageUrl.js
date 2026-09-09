// รูปที่อัปโหลด (proof/badge icon/reward image) อาจเป็น URL เต็มจาก Cloudinary
// หรือ relative path แบบเก่า ('uploads/...') ที่ตกค้างจากก่อนย้ายมา Cloudinary
// ฟังก์ชันนี้ต่อ apiBase ให้เฉพาะกรณี relative path เท่านั้น
export function resolveImageUrl(apiBase, path) {
  if (!path) return null;
  return /^https?:\/\//i.test(path) ? path : `${apiBase}/${path}`;
}
