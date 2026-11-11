const postIdPattern = /^[A-Za-z0-9_-]+$/;

export function thumbnailFileName(postId) {
  if (!postIdPattern.test(postId)) throw new Error(`Invalid post_id for thumbnail filename: ${postId}`);
  return `${postId}.jpg`;
}
