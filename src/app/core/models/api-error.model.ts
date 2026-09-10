export interface ApiError {
  code: string;
  type: string;
  message: string;
  status?: number;
  location: string | null;
  attr: string | null;
  nested_errors?: ApiError[];
}
