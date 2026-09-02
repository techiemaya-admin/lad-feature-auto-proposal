import { randomUUID } from "node:crypto"
import type { Document } from "docxmlater"

export class SessionStore {
  private sessions = new Map<string, Document>()

  /**
   * Store a Document instance and return its generated docId.
   */
  create(doc: Document): string {
    const docId = randomUUID()
    this.sessions.set(docId, doc)
    return docId
  }

  /**
   * Retrieve an active Document instance by docId.
   */
  get(docId: string): Document | undefined {
    return this.sessions.get(docId)
  }

  /**
   * Delete an active Document instance by docId.
   */
  delete(docId: string): boolean {
    return this.sessions.delete(docId)
  }

  /**
   * Clear all active sessions (e.g. for testing reset).
   */
  clear(): void {
    this.sessions.clear()
  }

  /**
   * Return the count of active sessions.
   */
  size(): number {
    return this.sessions.size
  }
}

export const sessionStore = new SessionStore()
