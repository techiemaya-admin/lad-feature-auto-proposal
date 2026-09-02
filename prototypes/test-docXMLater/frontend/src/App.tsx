import * as React from "react"
import {
  FileSpreadsheet,
  Upload,
  Download,
  Search,
  Crosshair,
  Plus,
  Trash2,
  Eraser,
  Sparkles,
  Sun,
  Moon,
  Loader2,
  FileText,
  RotateCcw,
  Check,
  AlertCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table-ui"
import {
  NotificationBanner,
  type NotificationItem,
  type NotificationType,
} from "@/components/notification-banner"
import { useTheme } from "@/components/theme-provider"
import {
  uploadDocument,
  getTable,
  searchTable,
  searchRow,
  addRow,
  removeRow,
  clearRow,
  removeEmptyRows,
  downloadDocument,
  type TableMeta,
  type TableData,
  ApiError,
} from "@/lib/api"

export function App() {
  const { theme, setTheme } = useTheme()

  // State
  const [docId, setDocId] = React.useState<string | null>(null)
  const [docFileName, setDocFileName] = React.useState<string>("")
  const [tables, setTables] = React.useState<TableMeta[]>([])
  const [activeTableIndex, setActiveTableIndex] = React.useState<number | null>(null)
  const [activeTable, setActiveTable] = React.useState<TableData | null>(null)
  const [targetedRowIndex, setTargetedRowIndex] = React.useState<number | null>(null)

  // Inputs
  const [tableSearchQuery, setTableSearchQuery] = React.useState("")
  const [rowSearchQuery, setRowSearchQuery] = React.useState("")
  const [rowTargetInput, setRowTargetInput] = React.useState("")

  // Loading States
  const [isUploading, setIsUploading] = React.useState(false)
  const [isLoadingTable, setIsLoadingTable] = React.useState(false)
  const [isMutating, setIsMutating] = React.useState(false)
  const [isDownloading, setIsDownloading] = React.useState(false)

  // Drag-and-drop state
  const [isDragging, setIsDragging] = React.useState(false)

  // Notifications
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([])

  const addNotification = React.useCallback(
    (type: NotificationType, title: string, message?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const item: NotificationItem = { id, type, title, message, timestamp: Date.now() }
      setNotifications((prev) => [...prev, item])

      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id))
      }, 4500)
    },
    []
  )

  const dismissNotification = React.useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  // Fetch full table data
  const loadTableData = React.useCallback(
    async (targetDocId: string, index: number) => {
      setIsLoadingTable(true)
      try {
        const data = await getTable(targetDocId, index)
        setActiveTable(data)
        setActiveTableIndex(index)
        setTargetedRowIndex(null)
        setRowTargetInput("")
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Failed to load table."
        addNotification("error", "Table Load Error", msg)
      } finally {
        setIsLoadingTable(false)
      }
    },
    [addNotification]
  )

  // File Upload Handler
  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith(".docx")) {
      addNotification("error", "Invalid File Format", "Please upload a valid Microsoft Word (.docx) document.")
      return
    }

    setIsUploading(true)
    try {
      const resp = await uploadDocument(file)
      setDocId(resp.docId)
      setDocFileName(file.name)
      setTables(resp.tables)
      addNotification(
        "success",
        "Document Uploaded",
        `Parsed "${file.name}" with ${resp.tableCount} table${resp.tableCount === 1 ? "" : "s"}.`
      )

      if (resp.tables.length > 0) {
        await loadTableData(resp.docId, 0)
      } else {
        setActiveTableIndex(null)
        setActiveTable(null)
        setTargetedRowIndex(null)
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Document upload failed."
      addNotification("error", "Upload Failed", msg)
    } finally {
      setIsUploading(false)
    }
  }

  // Handle Drag & Drop
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0])
    }
  }

  // Table Search
  const handleSearchTable = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!docId || !tableSearchQuery.trim()) return

    setIsLoadingTable(true)
    try {
      const result = await searchTable(docId, tableSearchQuery.trim())
      addNotification(
        "success",
        "Table Found",
        `Matched Table #${result.foundIndex} (${result.rowCount} rows × ${result.columnCount} cols).`
      )
      await loadTableData(docId, result.foundIndex)
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : `No table matching "${tableSearchQuery}" found.`
      addNotification("error", "Table Search Miss", msg)
    } finally {
      setIsLoadingTable(false)
    }
  }

  // Row Search
  const handleSearchRow = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!docId || activeTableIndex === null || !rowSearchQuery.trim()) return

    try {
      const result = await searchRow(docId, activeTableIndex, rowSearchQuery.trim())
      setTargetedRowIndex(result.foundRowIndex)
      setRowTargetInput(result.foundRowIndex.toString())
      addNotification(
        "success",
        "Row Located",
        `Row #${result.foundRowIndex} contains "${rowSearchQuery.trim()}".`
      )
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : `No row matching "${rowSearchQuery}" found in Table #${activeTableIndex}.`
      addNotification("error", "Row Search Miss", msg)
    }
  }

  // Target Row by Index Input
  const handleTargetRowByIndex = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!activeTable) return

    const idx = parseInt(rowTargetInput, 10)
    if (Number.isNaN(idx) || idx < 0 || idx >= activeTable.rowCount) {
      addNotification(
        "warning",
        "Invalid Row Index",
        `Index must be between 0 and ${activeTable.rowCount - 1}.`
      )
      return
    }

    setTargetedRowIndex(idx)
    addNotification("info", "Row Targeted", `Currently targeting Row #${idx}.`)
  }

  // Mutation: Add Row Below
  const handleAddRow = async () => {
    if (!docId || activeTableIndex === null || !activeTable) return

    setIsMutating(true)
    try {
      const targetPos = targetedRowIndex !== null ? targetedRowIndex : undefined
      const result = await addRow(docId, activeTableIndex, targetPos)

      const newRowCount = result.rowCount ?? result.grid.length
      setActiveTable({
        ...activeTable,
        grid: result.grid,
        rowCount: newRowCount,
      })

      // Update tables list metadata
      setTables((prev) =>
        prev.map((t) =>
          t.index === activeTableIndex ? { ...t, rowCount: newRowCount } : t
        )
      )

      const newlyAddedIndex = targetPos !== undefined ? targetPos + 1 : newRowCount - 1
      setTargetedRowIndex(newlyAddedIndex)
      setRowTargetInput(newlyAddedIndex.toString())

      addNotification(
        "success",
        "Row Inserted",
        targetPos !== undefined
          ? `Inserted new blank row below Row #${targetPos} (now Row #${newlyAddedIndex}).`
          : `Appended new blank row at bottom (Row #${newlyAddedIndex}).`
      )
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to add row."
      addNotification("error", "Mutation Error", msg)
    } finally {
      setIsMutating(false)
    }
  }

  // Mutation: Remove Row
  const handleRemoveRow = async () => {
    if (!docId || activeTableIndex === null || targetedRowIndex === null || !activeTable) return

    if (activeTable.rowCount <= 1) {
      addNotification(
        "error",
        "Deletion Blocked",
        "Cannot delete row: OpenXML tables must contain at least one row."
      )
      return
    }

    setIsMutating(true)
    try {
      const deletedIndex = targetedRowIndex
      const result = await removeRow(docId, activeTableIndex, deletedIndex)

      const newRowCount = result.rowCount ?? result.grid.length
      setActiveTable({
        ...activeTable,
        grid: result.grid,
        rowCount: newRowCount,
      })

      setTables((prev) =>
        prev.map((t) =>
          t.index === activeTableIndex ? { ...t, rowCount: newRowCount } : t
        )
      )

      // Adjust targeted row
      if (newRowCount === 0) {
        setTargetedRowIndex(null)
        setRowTargetInput("")
      } else if (deletedIndex >= newRowCount) {
        setTargetedRowIndex(newRowCount - 1)
        setRowTargetInput((newRowCount - 1).toString())
      } else {
        setTargetedRowIndex(deletedIndex)
        setRowTargetInput(deletedIndex.toString())
      }

      addNotification("success", "Row Removed", `Removed Row #${deletedIndex} successfully.`)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to remove row."
      addNotification("error", "Deletion Failed", msg)
    } finally {
      setIsMutating(false)
    }
  }

  // Mutation: Clear Row Contents
  const handleClearRow = async () => {
    if (!docId || activeTableIndex === null || targetedRowIndex === null || !activeTable) return

    setIsMutating(true)
    try {
      const result = await clearRow(docId, activeTableIndex, targetedRowIndex)
      setActiveTable({
        ...activeTable,
        grid: result.grid,
      })
      addNotification(
        "success",
        "Row Cleared",
        `Emptied cell contents in Row #${targetedRowIndex} non-destructively.`
      )
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to clear row."
      addNotification("error", "Clear Failed", msg)
    } finally {
      setIsMutating(false)
    }
  }

  // Mutation: Remove Empty Rows
  const handleRemoveEmptyRows = async () => {
    if (!docId || activeTableIndex === null || !activeTable) return

    setIsMutating(true)
    try {
      const result = await removeEmptyRows(docId, activeTableIndex)
      const count = result.removedCount ?? 0
      const newRowCount = result.rowCount ?? result.grid.length

      setActiveTable({
        ...activeTable,
        grid: result.grid,
        rowCount: newRowCount,
      })

      setTables((prev) =>
        prev.map((t) =>
          t.index === activeTableIndex ? { ...t, rowCount: newRowCount } : t
        )
      )

      // Re-evaluate targeted row
      if (targetedRowIndex !== null && targetedRowIndex >= newRowCount) {
        setTargetedRowIndex(newRowCount > 0 ? newRowCount - 1 : null)
        setRowTargetInput(newRowCount > 0 ? (newRowCount - 1).toString() : "")
      }

      if (count > 0) {
        addNotification(
          "success",
          "Empty Rows Cleaned",
          `Successfully removed ${count} empty row${count === 1 ? "" : "s"} from the table.`
        )
      } else {
        addNotification(
          "info",
          "Sweep Complete",
          "No completely empty rows were found in this table."
        )
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to remove empty rows."
      addNotification("error", "Cleanup Failed", msg)
    } finally {
      setIsMutating(false)
    }
  }

  // Download Document
  const handleDownload = async () => {
    if (!docId) return
    setIsDownloading(true)
    try {
      const name = docFileName ? `${docFileName.replace(/\.docx$/i, "")}-modified.docx` : "modified.docx"
      await downloadDocument(docId, name)
      addNotification("success", "Download Started", `Downloaded "${name}".`)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to download document."
      addNotification("error", "Download Error", msg)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground selection:bg-primary/20">
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-md px-4 sm:px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-xs">
            <FileSpreadsheet className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-semibold tracking-tight">
                docXMLater Table & Row Workspace
              </h1>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                v12.1.0
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              OpenXML table testing sandbox & row mutation harness
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {docId ? (
            <div className="hidden md:flex items-center gap-2 text-xs bg-muted/60 px-2.5 py-1 rounded-md border border-border">
              <FileText className="size-3.5 text-primary" />
              <span className="font-medium truncate max-w-[160px]" title={docFileName}>
                {docFileName}
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">{tables.length} tables</span>
            </div>
          ) : (
            <Badge variant="secondary" className="text-xs font-normal hidden sm:inline-flex">
              No Document Loaded
            </Badge>
          )}

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title="Toggle theme (or press 'd')"
            className="text-muted-foreground hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>

          {/* Download Button */}
          <Button
            variant="default"
            size="sm"
            disabled={!docId || isDownloading}
            onClick={handleDownload}
            className="shadow-xs font-medium"
          >
            {isDownloading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            <span>Download .docx</span>
          </Button>
        </div>
      </header>

      {/* Main Workspace Split Layout */}
      <main className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Left Control Sidebar */}
        <aside className="w-full lg:w-96 xl:w-[420px] shrink-0 border-r border-border bg-card/40 p-4 sm:p-5 flex flex-col gap-5 overflow-y-auto max-h-[calc(100vh-57px)]">
          {/* Card 1: Document Uploader */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Document Upload</CardTitle>
                {docId && (
                  <Badge variant="success" className="text-[10px] gap-1">
                    <Check className="size-3" /> Ready
                  </Badge>
                )}
              </div>
              <CardDescription>
                Upload an ECMA-376 (.docx) file to initialize docXMLater.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer transition-all ${
                  isDragging
                    ? "border-primary bg-primary/10 scale-[0.99]"
                    : "border-border hover:border-primary/50 hover:bg-muted/30"
                } ${isUploading ? "pointer-events-none opacity-60" : ""}`}
              >
                <input
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileUpload(e.target.files[0])
                    }
                  }}
                />
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Parsing OpenXML DOM...
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 py-1 text-center">
                    <div className="p-2 rounded-full bg-muted text-muted-foreground">
                      <Upload className="size-4" />
                    </div>
                    <span className="text-xs font-medium text-foreground">
                      Click to browse or drop .docx
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Up to 50MB supported
                    </span>
                  </div>
                )}
              </label>

              {docId && (
                <div className="flex items-center justify-between text-xs bg-muted/40 p-2.5 rounded-md border border-border">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="size-4 text-primary shrink-0" />
                    <span className="truncate font-medium" title={docFileName}>
                      {docFileName}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                    {tables.length} {tables.length === 1 ? "Table" : "Tables"}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 2: Table Selection & Search */}
          <Card className={!docId ? "opacity-50 pointer-events-none" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Table Selection</CardTitle>
                {activeTable && (
                  <Badge variant="secondary" className="text-[10px]">
                    Active: #{activeTable.index}
                  </Badge>
                )}
              </div>
              <CardDescription>
                Select table by zero-based index or search by contained text.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Select by dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Choose Table by Index
                </label>
                <div className="flex gap-2">
                  <select
                    disabled={!docId || tables.length === 0}
                    value={activeTableIndex ?? ""}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      if (!Number.isNaN(val) && docId) {
                        loadTableData(docId, val)
                      }
                    }}
                    className="flex h-8 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {tables.length === 0 ? (
                      <option value="">No tables in document</option>
                    ) : (
                      tables.map((tbl) => (
                        <option key={tbl.index} value={tbl.index} className="bg-popover text-popover-foreground">
                          Table #{tbl.index} ({tbl.rowCount}r × {tbl.columnCount}c){" "}
                          {tbl.preview ? `— ${tbl.preview.slice(0, 20)}...` : ""}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Search Table by Text */}
              <form onSubmit={handleSearchTable} className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Search Table by Text
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. Total, Pricing, Item"
                    value={tableSearchQuery}
                    onChange={(e) => setTableSearchQuery(e.target.value)}
                    disabled={!docId || isMutating || isLoadingTable}
                    className="text-xs"
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    disabled={!docId || !tableSearchQuery.trim() || isLoadingTable}
                  >
                    {isLoadingTable ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Search className="size-3.5" />
                    )}
                    <span>Find</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Card 3: Row Targeting & Search */}
          <Card className={!activeTable ? "opacity-50 pointer-events-none" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Row Targeting</CardTitle>
                {targetedRowIndex !== null ? (
                  <Badge variant="default" className="text-[10px] gap-1">
                    <Crosshair className="size-3" />
                    Row #{targetedRowIndex}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    None (Bottom)
                  </Badge>
                )}
              </div>
              <CardDescription>
                Target a row by zero-based index or search text within active table.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Target by index */}
              <form onSubmit={handleTargetRowByIndex} className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Target Row Index (0 to {activeTable ? activeTable.rowCount - 1 : 0})
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={activeTable ? Math.max(0, activeTable.rowCount - 1) : 0}
                    placeholder="e.g. 0"
                    value={rowTargetInput}
                    onChange={(e) => setRowTargetInput(e.target.value)}
                    disabled={!activeTable}
                    className="text-xs font-mono"
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    disabled={!activeTable || rowTargetInput === ""}
                  >
                    <Crosshair className="size-3.5" />
                    <span>Target</span>
                  </Button>
                </div>
              </form>

              {/* Search row by text */}
              <form onSubmit={handleSearchRow} className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Search Row by Contained Text
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. Subtotal, Consulting"
                    value={rowSearchQuery}
                    onChange={(e) => setRowSearchQuery(e.target.value)}
                    disabled={!activeTable}
                    className="text-xs"
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    disabled={!activeTable || !rowSearchQuery.trim()}
                  >
                    <Search className="size-3.5" />
                    <span>Locate</span>
                  </Button>
                </div>
              </form>

              {targetedRowIndex !== null && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">
                    Targeted row: <span className="font-semibold text-foreground">#{targetedRowIndex}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setTargetedRowIndex(null)
                      setRowTargetInput("")
                    }}
                    className="text-xs gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="size-3" />
                    Clear Target
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 4: Row Actions & Mutations */}
          <Card className={!activeTable ? "opacity-50 pointer-events-none" : ""}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Row Actions</CardTitle>
              <CardDescription>
                Execute structural or cell mutations on Table #{activeTable?.index ?? 0}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                {/* Add Row Below */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddRow}
                  disabled={!activeTable || isMutating}
                  className="justify-start gap-2 h-9"
                  title={
                    targetedRowIndex !== null
                      ? `Insert empty row below Row #${targetedRowIndex}`
                      : "Append empty row at bottom of table"
                  }
                >
                  <Plus className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <div className="flex flex-col items-start text-left">
                    <span className="font-medium text-xs">Add Row Below</span>
                    <span className="text-[10px] text-muted-foreground">
                      {targetedRowIndex !== null ? `Below #${targetedRowIndex}` : "At table bottom"}
                    </span>
                  </div>
                </Button>

                {/* Remove Specific Row */}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRemoveRow}
                  disabled={!activeTable || targetedRowIndex === null || isMutating}
                  className="justify-start gap-2 h-9"
                  title={
                    targetedRowIndex === null
                      ? "Target a row first to delete it"
                      : `Delete Row #${targetedRowIndex}`
                  }
                >
                  <Trash2 className="size-4" />
                  <div className="flex flex-col items-start text-left">
                    <span className="font-medium text-xs">Remove Row</span>
                    <span className="text-[10px] opacity-80">
                      {targetedRowIndex !== null ? `Deletes Row #${targetedRowIndex}` : "Target a row first"}
                    </span>
                  </div>
                </Button>

                {/* Clear Row Contents */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearRow}
                  disabled={!activeTable || targetedRowIndex === null || isMutating}
                  className="justify-start gap-2 h-9"
                  title={
                    targetedRowIndex === null
                      ? "Target a row first to clear it"
                      : `Clear text in Row #${targetedRowIndex}`
                  }
                >
                  <Eraser className="size-4 text-amber-600 dark:text-amber-400" />
                  <div className="flex flex-col items-start text-left">
                    <span className="font-medium text-xs">Clear Row Contents</span>
                    <span className="text-[10px] text-muted-foreground">
                      {targetedRowIndex !== null ? `Clears Row #${targetedRowIndex}` : "Target a row first"}
                    </span>
                  </div>
                </Button>

                {/* Remove Empty Rows */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveEmptyRows}
                  disabled={!activeTable || isMutating}
                  className="justify-start gap-2 h-9"
                  title="Purge all blank rows from the table"
                >
                  <Sparkles className="size-4 text-primary" />
                  <div className="flex flex-col items-start text-left">
                    <span className="font-medium text-xs">Remove Empty Rows</span>
                    <span className="text-[10px] text-muted-foreground">
                      Purge all blank rows
                    </span>
                  </div>
                </Button>
              </div>

              {activeTable && activeTable.rowCount <= 1 && (
                <div className="flex items-center gap-1.5 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] mt-2">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>Single-row invariant: table cannot be made empty.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>

        {/* Right Display Panel */}
        <section className="flex-1 flex flex-col min-w-0 bg-muted/15 p-4 sm:p-6 overflow-hidden">
          {/* Panel Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <h2 className="text-base sm:text-lg font-semibold tracking-tight">
                {activeTable ? `Table #${activeTable.index} Grid View` : "Table Grid Viewer"}
              </h2>
              {activeTable && (
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="font-mono text-xs">
                    {activeTable.rowCount} {activeTable.rowCount === 1 ? "row" : "rows"}
                  </Badge>
                  <span className="text-muted-foreground text-xs">×</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {activeTable.columnCount} {activeTable.columnCount === 1 ? "column" : "columns"}
                  </Badge>
                </div>
              )}
            </div>

            {activeTable && (
              <div className="flex items-center gap-2">
                {targetedRowIndex !== null ? (
                  <Badge variant="default" className="text-xs gap-1.5 py-1">
                    <span className="size-1.5 rounded-full bg-primary-foreground animate-pulse" />
                    Targeted: Row #{targetedRowIndex}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground italic">
                    Click any row below to target it
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Grid Container */}
          <div className="flex-1 min-h-0 pt-4 overflow-auto relative">
            {isLoadingTable || isMutating ? (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/60 backdrop-blur-xs gap-2">
                <Loader2 className="size-8 animate-spin text-primary" />
                <span className="text-xs font-medium text-muted-foreground">
                  {isMutating ? "Applying mutation to OpenXML DOM..." : "Loading table matrix..."}
                </span>
              </div>
            ) : null}

            {!docId ? (
              <div className="h-full min-h-[350px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-border rounded-xl bg-card/20">
                <div className="p-3 rounded-full bg-muted text-muted-foreground mb-3">
                  <FileSpreadsheet className="size-8 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">No Document Loaded</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  Upload a Microsoft Word (.docx) document in the left sidebar to discover tables,
                  target rows, and run mutations.
                </p>
              </div>
            ) : !activeTable ? (
              <div className="h-full min-h-[350px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-border rounded-xl bg-card/20">
                <h3 className="text-sm font-semibold text-foreground">No Table Selected</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  Select a table from the sidebar dropdown or search by keyword to preview its grid.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/70 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-16 font-mono text-[11px] text-center border-r border-border">
                        #
                      </TableHead>
                      {Array.from({ length: activeTable.columnCount }).map((_, colIdx) => (
                        <TableHead
                          key={colIdx}
                          className="font-mono text-xs border-r border-border last:border-r-0 px-3.5"
                        >
                          Col {colIdx}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeTable.grid.map((row, rowIdx) => {
                      const isTargeted = rowIdx === targetedRowIndex
                      return (
                        <TableRow
                          key={rowIdx}
                          onClick={() => {
                            setTargetedRowIndex(rowIdx)
                            setRowTargetInput(rowIdx.toString())
                            addNotification("info", "Row Targeted", `Targeted Row #${rowIdx}.`)
                          }}
                          className={`cursor-pointer transition-all ${
                            isTargeted
                              ? "bg-primary/15 dark:bg-primary/25 border-l-4 border-l-primary hover:bg-primary/20 dark:hover:bg-primary/30"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          {/* Row Number & Target Badge */}
                          <TableCell
                            className={`font-mono text-xs text-center border-r border-border select-none ${
                              isTargeted ? "font-bold text-primary" : "text-muted-foreground"
                            }`}
                          >
                            <div className="flex items-center justify-center gap-1">
                              <span>#{rowIdx}</span>
                              {isTargeted && (
                                <span className="size-1.5 rounded-full bg-primary" />
                              )}
                            </div>
                          </TableCell>

                          {/* Cell Contents */}
                          {row.map((cellText, colIdx) => (
                            <TableCell
                              key={colIdx}
                              className={`border-r border-border last:border-r-0 px-3.5 py-2.5 font-sans leading-relaxed ${
                                isTargeted ? "text-foreground font-medium" : "text-foreground/90"
                              }`}
                            >
                              {cellText.trim() === "" ? (
                                <span className="text-muted-foreground/40 italic text-xs select-none">
                                  &lt;empty&gt;
                                </span>
                              ) : (
                                <span className="break-words whitespace-pre-wrap">
                                  {cellText}
                                </span>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Toast Notification Banner Stack */}
      <NotificationBanner
        notifications={notifications}
        onDismiss={dismissNotification}
      />
    </div>
  )
}

export default App
