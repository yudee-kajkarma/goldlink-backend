export const uploadToStorage = async (file: Express.Multer.File): Promise<string> => {
  // In the future, this can be updated to upload to AWS S3.
  // For now, it returns the local URL.
  // Make sure the server URL matches the environment where it's running.
  // Using a relative URL or absolute local URL for now.
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  return `${baseUrl}/uploads/${file.filename}`;
};
