export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly title: string,
    public readonly type: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
