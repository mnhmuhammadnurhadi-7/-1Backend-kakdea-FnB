export const successResponse = (data: any, message?: string) => {
  return {
    success: true,
    data,
    ...(message && { message })
  };
};

export const errorResponse = (message: string, status: number = 400) => {
  const error: any = new Error(message);
  error.status = status;
  return error;
};