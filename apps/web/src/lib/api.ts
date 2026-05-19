const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

export async function apiRequest(path: string, options: RequestInit = {}) {
  const url = `${API_URL}${path}`;
  
  // Set default credentials to 'include' for cross-origin cookies (Better Auth)
  const defaultOptions: RequestInit = {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  };

  const response = await fetch(url, defaultOptions);
  
  if (!response.ok) {
    let errorMessage = "Ocorreu um erro na requisição";
    try {
      const data = await response.json();
      errorMessage = data.error || errorMessage;
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  return response.json();
}
