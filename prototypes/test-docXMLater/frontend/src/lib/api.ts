export interface TableMeta {
  index: number
  rowCount: number
  columnCount: number
  preview: string
}

export interface UploadResponse {
  docId: string
  tableCount: number
  tables: TableMeta[]
}

export interface TableData {
  index: number
  rowCount: number
  columnCount: number
  grid: string[][]
}

export interface TableSearchResult {
  foundIndex: number
  rowCount: number
  columnCount: number
}

export interface RowSearchResult {
  foundRowIndex: number
}

export interface RowMutationResult {
  grid: string[][]
  rowCount?: number
  removedCount?: number
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `Request failed with status ${res.status}`
    try {
      const data = await res.json()
      if (data && typeof data.error === "string") {
        errorMsg = data.error
      }
    } catch {
      // JSON parse failed, use status text
      if (res.statusText) errorMsg = res.statusText
    }
    throw new ApiError(errorMsg, res.status)
  }
  return res.json() as Promise<T>
}

export async function uploadDocument(file: File): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append("file", file)

  const res = await fetch("/api/document/upload", {
    method: "POST",
    body: formData,
  })
  return handleResponse<UploadResponse>(res)
}

export async function getTable(docId: string, tableIndex: number): Promise<TableData> {
  const res = await fetch(`/api/document/${encodeURIComponent(docId)}/tables/${tableIndex}`)
  return handleResponse<TableData>(res)
}

export async function searchTable(docId: string, query: string): Promise<TableSearchResult> {
  const res = await fetch(`/api/document/${encodeURIComponent(docId)}/tables/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  })
  return handleResponse<TableSearchResult>(res)
}

export async function searchRow(
  docId: string,
  tableIndex: number,
  query: string
): Promise<RowSearchResult> {
  const res = await fetch(
    `/api/document/${encodeURIComponent(docId)}/tables/${tableIndex}/rows/search`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    }
  )
  return handleResponse<RowSearchResult>(res)
}

export async function addRow(
  docId: string,
  tableIndex: number,
  afterRowIndex?: number
): Promise<RowMutationResult> {
  const res = await fetch(
    `/api/document/${encodeURIComponent(docId)}/tables/${tableIndex}/rows/add`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        afterRowIndex: afterRowIndex !== undefined ? afterRowIndex : undefined,
      }),
    }
  )
  return handleResponse<RowMutationResult>(res)
}

export async function removeRow(
  docId: string,
  tableIndex: number,
  rowIndex: number
): Promise<RowMutationResult> {
  const res = await fetch(
    `/api/document/${encodeURIComponent(docId)}/tables/${tableIndex}/rows/${rowIndex}`,
    {
      method: "DELETE",
    }
  )
  return handleResponse<RowMutationResult>(res)
}

export async function clearRow(
  docId: string,
  tableIndex: number,
  rowIndex: number
): Promise<RowMutationResult> {
  const res = await fetch(
    `/api/document/${encodeURIComponent(docId)}/tables/${tableIndex}/rows/${rowIndex}/clear`,
    {
      method: "POST",
    }
  )
  return handleResponse<RowMutationResult>(res)
}

export async function removeEmptyRows(
  docId: string,
  tableIndex: number
): Promise<RowMutationResult> {
  const res = await fetch(
    `/api/document/${encodeURIComponent(docId)}/tables/${tableIndex}/remove-empty-rows`,
    {
      method: "POST",
    }
  )
  return handleResponse<RowMutationResult>(res)
}

export async function downloadDocument(docId: string, downloadName = "modified.docx"): Promise<void> {
  const res = await fetch(`/api/document/${encodeURIComponent(docId)}/download`)
  if (!res.ok) {
    throw new ApiError(`Download failed with status ${res.status}`, res.status)
  }
  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = downloadName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}
